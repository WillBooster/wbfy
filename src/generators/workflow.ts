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
        cron: '0 5 * * *',
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
  if (rootConfig.depending.semanticRelease) {
    await promisePool.run(async () => {
      const yml = await getWorkflowYaml(rootConfig, workflowsPath, 'release');
      await fs.promises.writeFile(path.join(workflowsPath, 'release.yml'), yml);
    });
  }
  await promisePool.run(async () => {
    const yml = await getWorkflowYaml(rootConfig, workflowsPath, 'test');
    await fs.promises.writeFile(path.join(workflowsPath, 'test.yml'), yml);
  });
  await promisePool.run(async () => {
    const yml = await getWorkflowYaml(rootConfig, workflowsPath, 'wbfy');
    await fs.promises.writeFile(path.join(workflowsPath, 'wbfy.yml'), yml);
  });
}

async function getWorkflowYaml(
  config: PackageConfig,
  workflowsPath: string,
  kind: 'test' | 'release' | 'wbfy'
): Promise<string> {
  let newSettings = cloneDeep(
    kind === 'test' ? testWorkflow : kind === 'release' ? releaseWorkflow : wbfyWorkflow
  ) as any;
  if (kind === 'release') {
    newSettings.on.push.branches = config.release.branches;
  }
  let job = newSettings.jobs.test || newSettings.jobs.release || newSettings.jobs.wbfy;
  job.with ||= {};
  job.secrets ||= {};
  if (config.repository?.startsWith('github:WillBoosterLab/')) {
    job.uses = job.uses.replace('WillBooster/', 'WillBoosterLab/');
  }

  if (config.containingDockerfile) {
    job.with['cpu_arch'] = 'X64';
  }
  if (config.release.github || kind === 'wbfy') {
    if (config.publicRepo) {
      job.secrets['GH_TOKEN'] = '${{ secrets.PUBLIC_GH_BOT_PAT }}';
    } else {
      job.secrets['GH_TOKEN'] = '${{ secrets.GH_BOT_PAT }}';
    }
  }
  if (config.release.npm && kind !== 'wbfy') {
    job.secrets['NPM_TOKEN'] = '${{ secrets.NPM_TOKEN }}';
  }

  const filePath = path.join(workflowsPath, `${kind}.yml`);
  try {
    const oldContent = await fs.promises.readFile(filePath, 'utf-8');
    const oldSettings = yaml.load(oldContent);
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
  } catch (e) {
    // do nothing
  }

  job = newSettings.jobs.test || newSettings.jobs.release || newSettings.jobs.wbfy;
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
  if (kind === 'release' && newSettings.on.schedule) delete newSettings.on.push;
  if (kind === 'release') {
    await promisePool.run(() => fs.promises.rm('semantic-release.yml', { force: true }));
  }

  return yaml.dump(newSettings, {
    styles: {
      '!!null': 'empty',
    },
    noCompatMode: true,
  });
}
