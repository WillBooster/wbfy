import fs from 'fs';
import path from 'path';

import merge from 'deepmerge';
import yaml from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { combineMerge } from '../utils/mergeUtil';
import { sortKeys } from '../utils/objectUtil';
import { promisePool } from '../utils/promisePool';

const testWorkflow = {
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
};

const releaseWorkflow = {
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
};

const wbfyWorkflow = {
  name: 'Willboosterify',
  on: {
    workflow_dispatch: null,
  },
  jobs: {
    wbfy: {
      uses: 'WillBooster/reusable-workflows/.github/workflows/wbfy.yml@main',
    },
  },
};

const wbfyMergeWorkflow = {
  name: 'Merge wbfy',
  on: {
    workflow_dispatch: null,
  },
  jobs: {
    'wbfy-merge': {
      uses: 'WillBooster/reusable-workflows/.github/workflows/wbfy-merge.yml@main',
    },
  },
};

const semanticPullRequestWorkflow = {
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
};

const notifyReadyWorkflow = {
  name: 'Notify ready',
  on: {
    issues: {
      types: ['labeled'],
    },
  },
  jobs: {
    'notify-ready': {
      uses: 'WillBoosterLab/reusable-workflows/.github/workflows/notify-ready.yml@main',
      secrets: {
        DISCORD_WEBHOOK_URL: '${{ secrets.READY_DISCORD_WEBHOOK_URL }}',
      },
    },
  },
};

type KnownKind = 'test' | 'release' | 'sync' | 'wbfy' | 'wbfy-merge' | 'semantic-pr' | 'notify-ready';

export async function generateWorkflow(rootConfig: PackageConfig): Promise<void> {
  return logger.function('generateWorkflow', async () => {
    const workflowsPath = path.resolve(rootConfig.dirPath, '.github', 'workflows');
    await fs.promises.mkdir(workflowsPath, { recursive: true });

    // Remove config of semantic pull request
    const semanticYmlPath = path.resolve(rootConfig.dirPath, '.github', 'semantic.yml');
    await promisePool.run(() => fs.promises.rm(semanticYmlPath, { force: true, recursive: true }));

    const fileNames = (await fs.promises.readdir(workflowsPath, { withFileTypes: true }))
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml'))
      .map((dirent) => dirent.name);
    if (rootConfig.depending.semanticRelease) {
      fileNames.push('release.yml');
    }
    if (rootConfig.publicRepo || rootConfig.repository?.startsWith('github:WillBoosterLab/')) {
      fileNames.push('notify-ready.yml');
    }
    fileNames.push('test.yml', 'wbfy.yml', 'wbfy-merge.yml', 'semantic-pr.yml');

    for (const fileName of fileNames) {
      // 実際はKnownKind以外の値も代入されることに注意
      const kind = path.basename(fileName, '.yml') as KnownKind;
      await promisePool.run(() => writeWorkflowYaml(rootConfig, workflowsPath, kind));
    }
  });
}

async function writeWorkflowYaml(config: PackageConfig, workflowsPath: string, kind: KnownKind): Promise<void> {
  let newSettings: any = {};
  if (kind === 'test') {
    newSettings = testWorkflow;
  } else if (kind === 'release') {
    newSettings = releaseWorkflow;
  } else if (kind === 'wbfy') {
    newSettings = wbfyWorkflow;
  } else if (kind === 'wbfy-merge') {
    newSettings = wbfyMergeWorkflow;
  } else if (kind === 'semantic-pr') {
    newSettings = semanticPullRequestWorkflow;
  } else if (kind === 'notify-ready') {
    newSettings = notifyReadyWorkflow;
  }
  newSettings = cloneDeep(newSettings);

  const filePath = path.join(workflowsPath, `${kind}.yml`);
  try {
    const oldContent = await fs.promises.readFile(filePath, 'utf-8');
    const oldSettings = yaml.load(oldContent);
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
  } catch (e) {
    // do nothing
  }

  for (const job of Object.values(newSettings.jobs) as any[]) {
    // Ignore non-reusable workflows
    if (!job.uses?.includes?.('/reusable-workflows/')) return;

    normalizeJob(config, job, kind);
  }

  if (kind === 'release') {
    if (newSettings.on.schedule) {
      delete newSettings.on.push;
    } else {
      newSettings.on.push.branches = config.release.branches;
    }
  } else if (kind === 'wbfy') {
    setSchedule(newSettings, 20, 24);
  } else if (kind === 'wbfy-merge') {
    setSchedule(newSettings, 0, 4);
  }
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

  if ((config.release.github && kind === 'test') || kind === 'release' || kind === 'wbfy' || kind === 'wbfy-merge') {
    if (config.publicRepo) {
      job.secrets['GH_TOKEN'] = '${{ secrets.PUBLIC_GH_BOT_PAT }}';
    } else {
      job.secrets['GH_TOKEN'] = '${{ secrets.GH_BOT_PAT }}';
    }
  }
  if (config.release.npm && (kind === 'release' || kind === 'test')) {
    job.secrets['NPM_TOKEN'] = '${{ secrets.NPM_TOKEN }}';
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

  delete job.with['non_self_hosted'];
  if (config.containingDockerfile && kind.startsWith('deploy')) {
    job.with['cpu_arch'] = 'X64';
  }
  // Because github.event.repository.private is always true if job is scheduled
  if (kind === 'release' || kind === 'test' || kind === 'wbfy' || kind === 'wbfy-merge' || kind.startsWith('deploy')) {
    if (config.publicRepo) {
      job.with['github_hosted_runner'] = true;
    }
  } else {
    delete job.with['github_hosted_runner'];
  }
  if (Object.keys(job.with).length) {
    sortKeys(job.with);
  } else {
    delete job.with;
  }

  if (Object.keys(job.secrets).length) {
    sortKeys(job.secrets);
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
