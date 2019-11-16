import path from 'path';
import fs from 'fs-extra';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../types/packageConfig';

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
test-fixtures/
yarn.lock
`;

export async function generatePrettierignore(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.prettierignore');
  const userContent = IgnoreFileUtil.getUserContent(filePath) || defaultUserContent;

  const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
  const gitignoreContent = IgnoreFileUtil.getExistingContent(gitignoreFilePath) || '';

  await fs.outputFile(filePath, userContent + commonContent + gitignoreContent);
  console.log(`Generated ${filePath}`);
}
