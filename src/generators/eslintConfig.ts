import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

export async function generateEslintrc(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateEslintrc', async () => {
    // Remove deprecated files
    await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.eslintrc.json'), { force: true }));
    await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.eslintignore'), { force: true }));

    const filePath = path.resolve(config.dirPath, 'eslint.config.js');
    if (config.isBun) {
      await promisePool.run(() => fs.promises.rm(filePath, { force: true }));
      return;
    }

    if (!config.eslintBase) return;

    try {
      const oldContent = await fs.promises.readFile(filePath, 'utf8');
      if (!oldContent.includes('export { default }')) return;
    } catch {
      // do nothing
    }

    await promisePool.run(() => fsUtil.generateFile(filePath, `export { default } from '${config.eslintBase}';`));
  });
}
