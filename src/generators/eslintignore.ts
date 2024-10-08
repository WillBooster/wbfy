import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { ignoreFileUtil } from '../utils/ignoreFileUtil.js';
import { promisePool } from '../utils/promisePool.js';

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
  return logger.functionIgnoringException('generateEslintignore', async () => {
    const filePath = path.resolve(config.dirPath, '.eslintignore');
    if (config.isBun) {
      await promisePool.run(() => fs.promises.rm(filePath, { force: true }));
      return;
    }

    const content = (await fsUtil.readFileIgnoringError(filePath)) ?? '';
    const headUserContent = ignoreFileUtil.getHeadUserContent(content);
    const tailUserContent = ignoreFileUtil.getTailUserContent(content);

    const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
    const gitignoreContent = (await ignoreFileUtil.readGitignoreWithoutSeparators(gitignoreFilePath)) || '';

    const newContent = headUserContent + commonContent + gitignoreContent + tailUserContent;
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
