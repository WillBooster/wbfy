import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

import { FsUtil } from '../utils/fsUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

const newSettings = {
  titleOnly: true,
};

export async function generateSemanticYml(rootConfig: PackageConfig): Promise<void> {
  const githubPath = path.resolve(rootConfig.dirPath, '.github');
  await fs.promises.mkdir(githubPath, { recursive: true });
  const filePath = path.join(githubPath, 'semantic.yml');
  const newContent = yaml.dump(newSettings, { lineWidth: -1 });
  await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
}
