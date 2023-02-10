/* eslint-disable unicorn/no-null */

import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import yaml from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';
import { combineMerge } from '../utils/mergeUtil.js';
import { sortKeys } from '../utils/objectUtil.js';
import { promisePool } from '../utils/promisePool.js';

const workflows = {
  test: {
    name: 'Test',
    on: {
      pull_request: null,
      push: {
        branches: ['main', 'wbfy', 'renovate/**'],
      },
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
    name: 'Add issue to github project',
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
} as Record<KnownKind, any>;

type KnownKind =
  | 'test'
  | 'release'
  | 'sync'
  | 'wbfy'
  | 'wbfy-merge'
  | 'semantic-pr'
  | 'notify-ready'
  | 'close-comment'
  | 'add-issue-to-project';

export async function generateWorkflows(rootConfig: PackageConfig): Promise<void> {
  return logger.function('generateWorkflow', async () => {
    const workflowsPath = path.resolve(rootConfig.dirPath, '.github', 'workflows');
    await fs.promises.mkdir(workflowsPath, { recursive: true });

    // Remove config of semantic pull request
    const semanticYmlPath = path.resolve(rootConfig.dirPath, '.github', 'semantic.yml');
    await promisePool.run(() => fs.promises.rm(semanticYmlPath, { force: true, recursive: true }));

    const entries = await fs.promises.readdir(workflowsPath, { withFileTypes: true });
    const fileNames = entries
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml'))
      .map((dirent) => dirent.name);
    if (rootConfig.depending.semanticRelease) {
      fileNames.push('release.yml');
    }
    if (rootConfig.publicRepo || rootConfig.repository?.startsWith('github:WillBoosterLab/')) {
      fileNames.push('notify-ready.yml');
    }
    fileNames.push(
      'test.yml',
      'wbfy.yml',
      'wbfy-merge.yml',
      'semantic-pr.yml',
      'close-comment.yml',
      'add-issue-to-project.yml'
    );

    for (const fileName of fileNames) {
      // 実際はKnownKind以外の値も代入されることに注意
      const kind = path.basename(fileName, '.yml') as KnownKind;
      await promisePool.run(() => writeWorkflowYaml(rootConfig, workflowsPath, kind));
    }
  });
}

async function writeWorkflowYaml(config: PackageConfig, workflowsPath: string, kind: KnownKind): Promise<void> {
  let newSettings = cloneDeep(workflows[kind] || {});
  const filePath = path.join(workflowsPath, `${kind}.yml`);
  try {
    const oldContent = await fs.promises.readFile(filePath, 'utf8');
    const oldSettings = yaml.load(oldContent);
    if (kind === 'wbfy' || kind === 'wbfy-merge') {
      console.log('writeWorkflowYaml:', kind);
      console.dir(oldSettings, { depth: null });
    }
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
    if (kind === 'wbfy' || kind === 'wbfy-merge') {
      console.dir(newSettings, { depth: null });
    }
  } catch {
    // do nothing
  }
  for (const job of Object.values(newSettings.jobs) as any[]) {
    // Ignore non-reusable workflows
    if (!job.uses?.includes?.('/reusable-workflows/')) return;

    normalizeJob(config, job, kind);
  }

  switch (kind) {
    case 'release': {
      if (newSettings.on.schedule) {
        delete newSettings.on.push;
      } else if (config.release.branches.length > 0) {
        newSettings.on.push.branches = config.release.branches;
      } else {
        // Don't use release.yml if release branch is not specified
        await fs.promises.rm(path.join(workflowsPath, 'release.yml'), { force: true });
        return;
      }
      break;
    }
    case 'wbfy': {
      setSchedule(newSettings, 20, 24);
      break;
    }
    case 'wbfy-merge': {
      setSchedule(newSettings, 1, 4);
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
    if (!newSettings.jobs.sync) return;

    newSettings.jobs['sync-force'] = newSettings.jobs.sync;
    const params = newSettings.jobs.sync.with.sync_params_without_dest;
    if (!params) return;

    newSettings.jobs.sync.with.sync_params_without_dest = `--force ${params}`;
    newSettings.name = 'Force to Sync';
    newSettings.on = { workflow_dispatch: null };
    delete newSettings.jobs.sync;
    await writeYaml(newSettings, path.join(workflowsPath, 'sync-force.yml'));
  }
}

function normalizeJob(config: PackageConfig, job: any, kind: KnownKind): void {
  job.with ||= {};
  job.secrets ||= {};

  if (
    kind === 'test' ||
    kind === 'release' ||
    kind === 'wbfy' ||
    kind === 'wbfy-merge' ||
    kind === 'add-issue-to-project'
  ) {
    job.secrets['GH_TOKEN'] = config.publicRepo ? '${{ secrets.PUBLIC_GH_BOT_PAT }}' : '${{ secrets.GH_BOT_PAT }}';
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
    if (params) {
      job.with.sync_params_without_dest = params.replace('sync ', '');
    }
  }

  if (config.repository?.startsWith('github:WillBooster/')) {
    job.uses = job.uses.replace('WillBoosterLab/', 'WillBooster/');
  } else if (config.repository?.startsWith('github:WillBoosterLab/')) {
    job.uses = job.uses.replace('WillBooster/', 'WillBoosterLab/');
  }

  // Remove deprecated parameters
  migrateJob(job);
  if (job.with['dot_env_path'] === '.env') {
    delete job.with['dot_env_path'];
  }

  if (config.containingDockerfile) {
    job.with['ci_size'] = 'large';
    if (kind.startsWith('deploy')) {
      job.with['cpu_arch'] = 'X64';
    }
  }
  // Because github.event.repository.private is always true if job is scheduled
  if (kind === 'release' || kind === 'test' || kind === 'wbfy' || kind === 'wbfy-merge' || kind.startsWith('deploy')) {
    if (config.publicRepo) {
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

function setSchedule(newSettings: any, inclusiveMinHourJst: number, exclusiveMaxHourJst: number): void {
  const [minuteUtc, hourUtc] = ((newSettings.on.schedule?.[0]?.cron as string) ?? '').split(' ').map(Number);
  if (minuteUtc !== 0 && Number.isInteger(hourUtc)) {
    const hourJst = (hourUtc + 9) % 24;
    const inRange =
      inclusiveMinHourJst < exclusiveMaxHourJst
        ? inclusiveMinHourJst <= hourJst && hourJst < exclusiveMaxHourJst
        : inclusiveMinHourJst <= hourJst || hourJst < exclusiveMaxHourJst;
    if (inRange) return;
    console.log(
      'setSchedule:',
      newSettings,
      minuteUtc,
      hourUtc,
      inRange,
      hourJst,
      inclusiveMinHourJst,
      exclusiveMaxHourJst
    );
  } else {
    console.log('setSchedule:', newSettings, minuteUtc, hourUtc);
  }

  const minJst = 1 + Math.floor(Math.random() * 59);
  const hourJst = inclusiveMinHourJst + Math.floor(Math.random() * (exclusiveMaxHourJst - inclusiveMinHourJst));
  const cron = `${minJst} ${(hourJst - 9 + 24) % 24} * * *`;
  newSettings.on.schedule = [{ cron }];
}

async function writeYaml(newSettings: any, filePath: string): Promise<void> {
  const yamlText = yaml.dump(newSettings, {
    lineWidth: -1,
    noCompatMode: true,
    styles: {
      '!!null': 'empty',
    },
  });
  await fs.promises.writeFile(filePath, yamlText);
}

function migrateWorkflow(newSettings: any): void {
  delete newSettings.jobs['add-to-project'];
}

function migrateJob(job: any): void {
  delete job.with['non_self_hosted'];
  delete job.with['notify_discord'];
  delete job.with['require_fly'];
  delete job.with['require_gcloud'];
}
