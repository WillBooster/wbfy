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
    pull_request: {
      branches: ['main', '!renovate/**'],
    },
    push: {
      branches: ['main', 'renovate/**'],
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
    schedule: [
      {
        cron: '0 20 * * *',
      },
    ],
    workflow_dispatch: null,
  },
  jobs: {
    wbfy: {
      uses: 'WillBooster/reusable-workflows/.github/workflows/wbfy.yml@main',
    },
  },
};

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

async function writeWorkflowYaml(
  config: PackageConfig,
  workflowsPath: string,
  kind: 'test' | 'release' | 'wbfy' | string
): Promise<void> {
  let newSettings: any = {};
  if (kind === 'test') {
    newSettings = testWorkflow;
  } else if (kind === 'release') {
    newSettings = releaseWorkflow;
  } else if (kind === 'wbfy') {
    newSettings = wbfyWorkflow;
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

  if (kind === 'release') {
    if (newSettings.on.schedule) {
      delete newSettings.on.push;
    } else {
      newSettings.on.push.branches = config.release.branches;
    }
  }

  for (const job of Object.values(newSettings.jobs) as any[]) {
    if (!job.uses?.includes?.('/reusable-workflows/')) break;

    normalizeJob(config, job, kind);
  }

  if (kind === 'release') {
    await promisePool.run(() => fs.promises.rm('semantic-release.yml', { force: true }));
  }
  const ymlText = yaml.dump(newSettings, {
    styles: {
      '!!null': 'empty',
    },
    noCompatMode: true,
  });
  await fs.promises.writeFile(filePath, ymlText);
}

function normalizeJob(config: PackageConfig, job: any, kind: string): void {
  job.with ||= {};
  job.secrets ||= {};
  if (config.release.github || kind === 'wbfy') {
    if (config.publicRepo) {
      job.secrets['GH_TOKEN'] = '${{ secrets.PUBLIC_GH_BOT_PAT }}';
    } else {
      job.secrets['GH_TOKEN'] = '${{ secrets.GH_BOT_PAT }}';
    }
  }
  if (config.release.npm && (kind === 'release' || kind === 'test')) {
    job.secrets['NPM_TOKEN'] = '${{ secrets.NPM_TOKEN }}';
  }

  if (config.repository?.startsWith('github:WillBooster/')) {
    job.uses = job.uses.replace('WillBoosterLab/', 'WillBooster/');
  } else if (config.repository?.startsWith('github:WillBoosterLab/')) {
    job.uses = job.uses.replace('WillBooster/', 'WillBoosterLab/');
  }

  if (config.containingDockerfile) {
    job.with['cpu_arch'] = 'X64';
  }
  delete job.with['non_self_hosted'];
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
