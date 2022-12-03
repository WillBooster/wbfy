import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { ignoreFileUtil } from '../utils/ignoreFileUtil';
import { promisePool } from '../utils/promisePool';

const commonContent = `
3rd-party/
@types/
__generated__/
android/
ios/
no-format/
test-fixtures/
*.config.*js
*.d.ts
*.min.*js
.yarn/
.pnp.js
`;

export async function generateEslintignore(config: PackageConfig): Promise<void> {
  return logger.function('generateEslintignore', async () => {
    const filePath = path.resolve(config.dirPath, '.eslintignore');
    const content = (await FsUtil.readFileIgnoringError(filePath)) ?? '';
    const headUserContent = ignoreFileUtil.getHeadUserContent(content) + commonContent;
    const tailUserContent = ignoreFileUtil.getTailUserContent(content);

    const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
    const gitignoreContent = (await ignoreFileUtil.readGitignoreWithoutSeparators(gitignoreFilePath)) || '';

    const newContent = headUserContent + commonContent + gitignoreContent + tailUserContent;
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
