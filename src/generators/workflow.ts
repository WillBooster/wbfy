import fsp from 'fs/promises';
import path from 'path';

import { fetchOnNode } from '../utils/fetchOnNode';
import { FsUtil } from '../utils/fsUtil';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../utils/packageConfig';

function getTestYml(isPrivate: boolean): string {
  const suffix = `with:
      non_self_hosted: true`;
  return `
name: Test

on:
  pull_request:
    branches:
      - 'main'
      - '!renovate/**'
  push:
    branches:
      - 'main'
      - 'renovate/**'

jobs:
  test:
    uses: WillBooster/reusable-workflows/.github/workflows/test.yml@main
    ${isPrivate ? '' : suffix}
`.trim();
}

export async function generateWorkflow(rootConfig: PackageConfig): Promise<void> {
  const testYmlPath = path.resolve(rootConfig.dirPath, '.github');
}
