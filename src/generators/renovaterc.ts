import path from 'path';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import fse from 'fs-extra';

const content = `{
  "extends": ["@willbooster"]
}
`;

export async function generateRenovateJson(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.renovaterc.json');
  await Promise.all([
    fse.remove(path.resolve(config.dirPath, '.dependabot')),
    fse.remove(path.resolve(config.dirPath, 'renovate.json')),
    FsUtil.generateFile(filePath, content),
  ]);
}
