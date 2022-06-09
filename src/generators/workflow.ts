import fs from 'fs';
import path from 'path';

import merge from 'deepmerge';
import yaml from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';

import { combineMerge } from '../utils/mergeUtil';
import { sortKeys } from '../utils/objectUtil';
import { PackageConfig } from '../utils/packageConfig';
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

type KnownKind = 'test' | 'release' | 'sync' | 'wbfy' | 'wbfy-merge' | 'semantic-pr';

export async function generateWorkflow(rootConfig: PackageConfig): Promise<void> {
  const workflowsPath = path.resolve(rootConfig.dirPath, '.github', 'workflows');
  await fs.promises.mkdir(workflowsPath, { recursive: true });

  const fileNames = (await fs.promises.readdir(workflowsPath, { withFileTypes: true }))
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.yml'))
    .map((dirent) => dirent.name);
  if (rootConfig.depending.semanticRelease) {
    fileNames.push('release.yml');
  }
  fileNames.push('test.yml', 'wbfy.yml');

  for (const fileName of fileNames) {
    const kind = path.basename(fileName, '.yml');
    await promisePool.run(() => writeWorkflowYaml(rootConfig, workflowsPath, kind));
  }
}

async function writeYaml(newSettings: any, filePath: string): Promise<void> {
  const yamlText = yaml.dump(newSettings, {
    lineWidth: -1,
    noCompatMode: true,
    styles: {
      '!!null': 'empty',
    },
  });
  await promisePool.run(() => fs.promises.writeFile(filePath, yamlText));
}

async function writeWorkflowYaml(
  config: PackageConfig,
  workflowsPath: string,
  kind: KnownKind | string
): Promise<void> {
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
    await promisePool.run(() => fs.promises.rm(path.join(workflowsPath, 'semantic-release.yml'), { force: true }));
  } else if (kind === 'sync') {
    await promisePool.run(() => fs.promises.rm(path.join(workflowsPath, 'sync-init.yml'), { force: true }));
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

function normalizeJob(config: PackageConfig, job: any, kind: KnownKind | string): void {
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
