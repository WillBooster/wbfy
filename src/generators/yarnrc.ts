import path from 'path';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const content = `save-prefix ""
`;

export async function generateYarnrc(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.yarnrc');
  await FsUtil.generateFile(filePath, content);
}
