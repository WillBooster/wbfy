import path from 'path';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
__generated__/
@types/
test-fixtures/
3rd-party/
*.config.js
*.min.js
*.d.ts
`;

export async function generateEslintignore(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.eslintignore');
  const userContent = IgnoreFileUtil.getUserContent(filePath) || defaultUserContent;

  const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
  const gitignoreContent = IgnoreFileUtil.getExistingContent(gitignoreFilePath) || '';

  await FsUtil.generateFile(filePath, userContent + commonContent + gitignoreContent);
}
