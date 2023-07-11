import fs from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';

export async function fixPlaywrightConfig(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('fixPlaywrightConfig', async () => {
    const filePath = path.join(config.dirPath, 'playwright.config.ts');
    const oldContent = await fs.readFile(filePath, 'utf8');

    const newContent = oldContent.replace(/retries:.+,/, 'retries: process.env.PWDEBUG ? 0 : process.env.CI ? 5 : 1,');
    if (oldContent === newContent) return;

    await fs.writeFile(filePath, newContent);
  });
}
