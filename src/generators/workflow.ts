import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import yaml from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';

import { PackageConfig } from '../utils/packageConfig';

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

function getTestWorkflow(config: PackageConfig, kind: 'test' | 'release'): string {
  const workflow = cloneDeep(kind === 'test' ? testWorkflow : releaseWorkflow) as any;
  if (kind === 'release') {
    workflow.on.push.branches = config.release.branches;
  }
  const job = workflow.jobs.test || workflow.jobs.release;
  if (!config.private) {
    job.with ||= {};
    job.with['non_self_hosted'] = true;
  }
  if (config.release.github) {
    job.secrets ||= {};
    if (config.private) {
      job.secrets['GH_TOKEN'] = '${{ secrets.GH_BOT_PAT }}';
    } else {
      job.secrets['GH_TOKEN'] = '${{ secrets.PUBLIC_GH_BOT_PAT }}';
    }
  }
  if (config.release.npm) {
    job.secrets ||= {};
    job.secrets['NPM_TOKEN'] = '${{ secrets.NPM_TOKEN }}';
  }
  return yaml.dump(workflow, { noCompatMode: true });
}

export async function generateWorkflow(rootConfig: PackageConfig): Promise<void> {
  const workflowsPath = path.resolve(rootConfig.dirPath, '.github', 'workflows');
  fs.mkdirSync(workflowsPath, { recursive: true });
  const promises: Promise<void>[] = [];
  if (rootConfig.depending.semanticRelease) {
    const releaseYml = getTestWorkflow(rootConfig, 'release');
    promises.push(fsp.writeFile(path.join(workflowsPath, 'release.yml'), releaseYml));
  }
  {
    const testYml = getTestWorkflow(rootConfig, 'test');
    promises.push(fsp.writeFile(path.join(workflowsPath, 'test.yml'), testYml));
  }
  await Promise.all(promises);
}
