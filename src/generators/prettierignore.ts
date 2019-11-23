import path from 'path';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
test-fixtures/
3rd-party/
yarn.lock
`;

export async function generatePrettierignore(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.prettierignore');
  const userContent = IgnoreFileUtil.getUserContent(filePath) || defaultUserContent;

  const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
  const gitignoreContent = IgnoreFileUtil.getExistingContent(gitignoreFilePath) || '';

  await FsUtil.generateFile(filePath, userContent + commonContent + gitignoreContent);
}
