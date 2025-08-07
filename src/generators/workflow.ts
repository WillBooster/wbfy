/* eslint-disable unicorn/no-null */

import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import yaml from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { combineMerge } from '../utils/mergeUtil.js';
import { moveToBottom, sortKeys } from '../utils/objectUtil.js';
import { promisePool } from '../utils/promisePool.js';

interface Workflow {
  name: string;
  on: On;
  concurrency?: Concurrency;
  jobs: { [key: string]: Job };
}

interface Concurrency {
  group: string;
  'cancel-in-progress': boolean;
}

interface On {
  issues?: Types;
  pull_request?: PullRequest;
  pull_request_target?: Types;
  push?: Push;
  schedule?: Schedule[];
  workflow_dispatch?: null;
}

interface PullRequest {
  'paths-ignore'?: string[];
  types?: string[];
}

interface Push {
  branches: string[];
  'paths-ignore'?: string[];
}

interface Schedule {
  cron: string;
}

interface Types {
  types: string[];
}

interface Job {
  uses: string;
  if?: string;
  secrets?: Record<string, unknown>;
  with?: Record<string, unknown>;
}

const workflows = {
  test: {
    name: 'Test',
    on: {
      pull_request: null,
      push: {
        branches: ['main', 'wbfy'],
      },
    },
    // cf. https://docs.github.com/en/actions/using-jobs/using-concurrency#example-only-cancel-in-progress-jobs-or-runs-for-the-current-workflow
    concurrency: {
      group: '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    jobs: {
      test: {
        uses: 'WillBooster/reusable-workflows/.github/workflows/test.yml@main',
      },
    },
  },
  release: {
    name: 'Release',
    on: {
      push: {
        branches: [],
      },
    },
    concurrency: {
      group: '${{ github.workflow }}',
      'cancel-in-progress': false,
    },
    jobs: {
      release: {
        uses: 'WillBooster/reusable-workflows/.github/workflows/release.yml@main',
      },
    },
  },
  wbfy: {
    name: 'Willboosterify',
    on: {
      workflow_dispatch: null,
    },
    jobs: {
      wbfy: {
        uses: 'WillBooster/reusable-workflows/.github/workflows/wbfy.yml@main',
      },
    },
  },
  'wbfy-merge': {
    name: 'Merge wbfy',
    on: {
      workflow_dispatch: null,
    },
    jobs: {
      'wbfy-merge': {
        uses: 'WillBooster/reusable-workflows/.github/workflows/wbfy-merge.yml@main',
      },
    },
  },
  'semantic-pr': {
    name: 'Lint PR title',
    on: {
      pull_request_target: {
        types: ['opened', 'edited', 'synchronize'],
      },
    },
    jobs: {
      'semantic-pr': {
        uses: 'WillBooster/reusable-workflows/.github/workflows/semantic-pr.yml@main',
      },
    },
  },
  sync: {
    name: 'Sync',
    on: {},
    jobs: {
      sync: { uses: 'WillBooster/reusable-workflows/.github/workflows/sync.yml@main' },
    },
  },
  'notify-ready': {
    name: 'Notify ready',
    on: {
      issues: {
        types: ['labeled'],
      },
    },
    jobs: {
      'notify-ready': {
        uses: 'WillBooster/reusable-workflows/.github/workflows/notify-ready.yml@main',
        secrets: {
          DISCORD_WEBHOOK_URL: '${{ secrets.DISCORD_WEBHOOK_URL_FOR_READY }}',
        },
      },
    },
  },
  'close-comment': {
    name: 'Add close comment',
    on: {
      pull_request: {
        types: ['opened'],
      },
    },
    jobs: {
      'close-comment': {
        uses: 'WillBooster/reusable-workflows/.github/workflows/close-comment.yml@main',
      },
    },
  },
  'add-issue-to-project': {
    name: 'Add issue to GitHub project',
    on: {
      issues: {
        types: ['labeled'],
      },
    },
    jobs: {
      'add-issue-to-project': {
        uses: 'WillBooster/reusable-workflows/.github/workflows/add-issue-to-project.yml@main',
        secrets: {
          GH_PROJECT_URL: '${{ secrets.GH_PROJECT_URL }}',
        },
      },
    },
  },
  'add-ready-issue-to-project': {
    name: 'Add ready issue to GitHub project',
    on: {
      issues: {
        types: ['labeled'],
      },
    },
    jobs: {
      'add-ready-issue-to-project': {
        uses: 'WillBooster/reusable-workflows/.github/workflows/add-issue-to-project.yml@main',
        with: {
          labeled: 'ready :rocket:',
        },
        secrets: {
          GH_PROJECT_URL: 'https://github.com/orgs/WillBoosterLab/projects/5',
        },
      },
    },
  },
  'gen-pr-claude': {
    name: 'Generate PR with Claude Code',
    on: {
      issues: {
        types: ['labeled'],
      },
      pull_request: {
        types: ['labeled'],
      },
    },
    jobs: {
      'gen-pr': {
        if: "contains(github.event.label.name, 'gen-pr-all') || contains(github.event.label.name, 'gen-pr-claude')",
        uses: 'WillBooster/reusable-workflows/.github/workflows/gen-pr.yml@main',
        with: {
          'coding-tool': 'claude-code',
          'issue-number': '${{ github.event.issue.number || github.event.number }}',
        },
        secrets: {
          CLAUDE_CODE_OAUTH_TOKEN: '${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}',
        },
      },
    },
  },
} as const;

type KnownKind = keyof typeof workflows | 'deploy';

export async function generateWorkflows(rootConfig: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateWorkflow', async () => {
    const workflowsPath = path.resolve(rootConfig.dirPath, '.github', 'workflows');
    await fs.promises.mkdir(workflowsPath, { recursive: true });

    // Remove config of semantic pull request
    const semanticYmlPath = path.resolve(rootConfig.dirPath, '.github', 'semantic.yml');
    await promisePool.run(() => fs.promises.rm(semanticYmlPath, { force: true, recursive: true }));

    const entries = await fs.promises.readdir(workflowsPath, { withFileTypes: true });
    const fileNameSet = new Set([
      'test.yml',
      'wbfy.yml',
      'wbfy-merge.yml',
      'semantic-pr.yml',
      'close-comment.yml',
      'add-issue-to-project.yml',
      'gen-pr-claude.yml',
      ...entries.filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml')).map((dirent) => dirent.name),
    ]);
    if (rootConfig.depending.semanticRelease) {
      fileNameSet.add('release.yml');
    }
    if (rootConfig.isPublicRepo || rootConfig.repository?.startsWith('github:WillBoosterLab/')) {
      fileNameSet.add('add-ready-issue-to-project.yml');
      fileNameSet.add('notify-ready.yml');
    }

    for (const fileName of fileNameSet) {
      // 実際はKnownKind以外の値も代入されることに注意
      const kind = path.basename(fileName, '.yml') as KnownKind;
      await promisePool.run(() => writeWorkflowYaml(rootConfig, workflowsPath, kind));
    }
    await promisePool.run(() =>
      fs.promises.rm(path.join(workflowsPath, 'add-focused-issue-to-project.yml'), { force: true, recursive: true })
    );
  });
}

async function writeWorkflowYaml(config: PackageConfig, workflowsPath: string, kind: KnownKind): Promise<void> {
  let newSettings = cloneDeep(workflows[kind as keyof typeof workflows] ?? {}) as Workflow;
  const filePath = path.join(workflowsPath, `${kind}.yml`);
  try {
    const oldContent = await fs.promises.readFile(filePath, 'utf8');
    const oldSettings = yaml.load(oldContent) as Workflow;
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge }) as Workflow;
  } catch {
    // do nothing
  }

  if (kind.startsWith('deploy')) {
    newSettings = {
      ...newSettings,
      concurrency: {
        group: '${{ github.workflow }}',
        'cancel-in-progress': false,
      },
    };
    // Move jobs to the bottom
    if (newSettings.jobs) {
      moveToBottom(newSettings, 'jobs');
    }
    if (newSettings.on?.push) {
      newSettings.on.push['paths-ignore'] = [
        ...new Set(['**.md', '**/docs/**', ...(newSettings.on.push['paths-ignore'] ?? [])]),
      ];
    }
  }

  for (const job of Object.values(newSettings.jobs)) {
    // Ignore non-reusable workflows
    if (!job.uses?.includes?.('/reusable-workflows/')) return;

    normalizeJob(config, job, kind);
  }

  switch (kind) {
    case 'release': {
      if (newSettings.on?.schedule) {
        delete newSettings.on.push;
      } else if (newSettings.on?.push && config.release.branches.length > 0) {
        newSettings.on.push.branches = config.release.branches;
      } else {
        // Don't use release.yml if release branch is not specified
        await fs.promises.rm(path.join(workflowsPath, 'release.yml'), { force: true });
        return;
      }
      break;
    }
    case 'test': {
      // Don't use `paths-ignore` for test because GitHub's Branch Protection and Rulesets require job running.
      delete newSettings.on?.pull_request?.['paths-ignore'];
      delete newSettings.on?.push?.['paths-ignore'];
      if (newSettings.on?.push) {
        newSettings.on.push.branches = newSettings.on.push.branches.filter((branch) => branch !== 'renovate/**');
      }
      break;
    }
    case 'wbfy': {
      if (newSettings.on) setSchedule(newSettings, 20, 24, false);
      break;
    }
    case 'wbfy-merge': {
      setSchedule(newSettings, 1, 4, true);
      break;
    }
    // No default
  }
  migrateWorkflow(newSettings);
  await writeYaml(newSettings, filePath);

  if (kind === 'release') {
    await fs.promises.rm(path.join(workflowsPath, 'semantic-release.yml'), { force: true });
  } else if (kind === 'sync') {
    await fs.promises.rm(path.join(workflowsPath, 'sync-init.yml'), { force: true });
    if (!newSettings.jobs.sync || !newSettings.jobs.sync.with) return;

    // Generate sync-force.yml based on sync.yml if it exists.
    newSettings.jobs['sync-force'] = newSettings.jobs.sync;
    const params = newSettings.jobs.sync.with.sync_params_without_dest;
    if (typeof params !== 'string') return;

    newSettings.jobs.sync.with.sync_params_without_dest = `--force ${params}`;
    newSettings.name = 'Force to Sync';
    newSettings.on = { workflow_dispatch: null };
    delete newSettings.jobs.sync;
    await writeYaml(newSettings, path.join(workflowsPath, 'sync-force.yml'));
  }
}

function normalizeJob(config: PackageConfig, job: Job, kind: KnownKind): void {
  job.with ||= {};
  job.secrets ||= {};

  if (
    kind === 'test' ||
    kind === 'release' ||
    kind === 'wbfy' ||
    kind === 'wbfy-merge' ||
    kind === 'add-issue-to-project' ||
    kind === 'add-ready-issue-to-project' ||
    kind === 'gen-pr-claude'
  ) {
    job.secrets['GH_TOKEN'] = config.isPublicRepo ? '${{ secrets.PUBLIC_GH_BOT_PAT }}' : '${{ secrets.GH_BOT_PAT }}';
  }
  if (config.release.npm && (kind === 'release' || kind === 'test')) {
    job.secrets['NPM_TOKEN'] = '${{ secrets.NPM_TOKEN }}';
  }
  if (job.secrets['FIREBASE_TOKEN']) {
    job.secrets['GCP_SA_KEY_JSON_FOR_FIREBASE'] = '${{ secrets.GCP_SA_KEY_JSON_FOR_FIREBASE }}';
    delete job.secrets['FIREBASE_TOKEN'];
  }
  if (
    (job.secrets['DISCORD_WEBHOOK_URL'] && (kind === 'release' || kind.startsWith('deploy'))) ||
    (job.with.server_url && kind.startsWith('deploy'))
  ) {
    job.secrets['DISCORD_WEBHOOK_URL'] = '${{ secrets.DISCORD_WEBHOOK_URL_FOR_RELEASE }}';
  }

  if (kind === 'sync') {
    const params = job.with?.sync_params_without_dest;
    if (typeof params === 'string') {
      job.with.sync_params_without_dest = params.replace('sync ', '');
    }
  }

  if (config.repository?.startsWith('github:WillBooster/')) {
    job.uses = job.uses.replace('WillBoosterLab/', 'WillBooster/');
  } else if (config.repository?.startsWith('github:WillBoosterLab/')) {
    job.uses = job.uses.replace('WillBooster/', 'WillBoosterLab/');
  }

  // Remove redundant parameters
  if (job.with['dot_env_path'] === '.env') {
    delete job.with['dot_env_path'];
  }
  // Remove deprecated parameters
  migrateJob(job);

  // Don't use `fly deploy --json` since it causes an error
  if (kind.startsWith('deploy') && job.secrets['FLY_API_TOKEN'] && typeof job.with['deploy_command'] === 'string') {
    job.with['deploy_command'] = job.with['deploy_command'].replace(/\s+--json/, '');
  }
  if (config.doesContainsDockerfile) {
    if (!job.with['ci_size'] && (kind.startsWith('deploy') || kind.startsWith('test'))) {
      job.with['ci_size'] = 'large';
    }
    if (kind.startsWith('deploy')) {
      job.with['cpu_arch'] = 'X64';
    }
  }
  // Because github.event.repository.private is always true if job is scheduled
  if (kind === 'release' || kind === 'test' || kind.startsWith('deploy')) {
    if (config.isPublicRepo) {
      job.with['github_hosted_runner'] = true;
    }
  } else {
    delete job.with['github_hosted_runner'];
  }

  if (Object.keys(job.with).length > 0) {
    sortKeys(job.with);
  } else {
    delete job.with;
  }
  if (Object.keys(job.secrets).length > 0) {
    // Move secrets prop after with prop
    const newSecrets = sortKeys(job.secrets);
    delete job.secrets;
    job.secrets = newSecrets;
  } else {
    delete job.secrets;
  }
}

function setSchedule(
  newSettings: Workflow,
  inclusiveMinHourJst: number,
  exclusiveMaxHourJst: number,
  runTwice: boolean
): void {
  const [minuteUtc, hourUtc] = ((newSettings.on.schedule?.[0]?.cron as string) || '').split(' ').map(Number);
  if (minuteUtc !== 0 && Number.isInteger(hourUtc) !== runTwice) {
    const hourJst = (hourUtc + 9) % 24;
    const inRange =
      inclusiveMinHourJst < exclusiveMaxHourJst
        ? inclusiveMinHourJst <= hourJst && hourJst < exclusiveMaxHourJst
        : inclusiveMinHourJst <= hourJst || hourJst < exclusiveMaxHourJst;
    if (inRange) return;
  }

  const minJst = 1 + Math.floor(Math.random() * 59);
  const hourJst = inclusiveMinHourJst + Math.floor(Math.random() * (exclusiveMaxHourJst - inclusiveMinHourJst));
  const newHourUtc = hourJst - 9 + 24;
  const cron = runTwice
    ? `${minJst} ${newHourUtc % 24},${(newHourUtc + 1) % 24} * * *`
    : `${minJst} ${newHourUtc % 24} * * *`;
  newSettings.on.schedule = [{ cron }];
}

async function writeYaml(newSettings: Workflow, filePath: string): Promise<void> {
  const yamlText = yaml.dump(newSettings, { lineWidth: -1, noCompatMode: true, styles: { '!!null': 'empty' } });
  await fs.promises.writeFile(filePath, yamlText);
}

function migrateWorkflow(newSettings: Workflow): void {
  // TODO: Remove them after 2023-03-31
  delete newSettings.jobs['add-to-project'];
}

function migrateJob(job: Job): void {
  // TODO: Remove them after 2023-03-31
  if (!job.with) return;
  delete job.with['non_self_hosted'];
  delete job.with['notify_discord'];
  delete job.with['require_fly'];
  delete job.with['require_gcloud'];
  delete job.with['cpu_arch'];
  delete job.with['label'];
  delete job.with['labelOperator'];
}
