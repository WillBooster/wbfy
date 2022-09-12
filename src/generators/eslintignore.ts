import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { promisePool } from '../utils/promisePool';

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
3rd-party/
@types/
__generated__/
android/
ios/
no-format/
test-fixtures/
*.config.js
*.d.ts
*.min.js
.yarn/
.pnp.js
`;

export async function generateEslintignore(config: PackageConfig): Promise<void> {
  return logger.function('generateEslintignore', async () => {
    const filePath = path.resolve(config.dirPath, '.eslintignore');
    const userContent = (await IgnoreFileUtil.getUserContent(filePath)) || defaultUserContent;

    const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
    const gitignoreContent = (await IgnoreFileUtil.getExistingContent(gitignoreFilePath)) || '';

    const newContent = userContent + commonContent + gitignoreContent;
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
