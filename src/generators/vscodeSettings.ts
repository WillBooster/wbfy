import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { sortKeys } from '../utils/objectUtil.js';
import { promisePool } from '../utils/promisePool.js';

function excludeSetting(excludeFile: string): unknown {
  return {
    'files.watcherExclude': {
      [excludeFile]: true,
    },
  };
}

export async function generateVscodeSettings(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateVscodeSettings', async () => {
    try {
      const filePath = path.resolve(config.dirPath, '.vscode', 'settings.json');
      const existingContent = await fs.promises.readFile(filePath, 'utf8');
      let settings = JSON.parse(existingContent);
      settings = merge.all([settings, excludeSetting('**/node_modules/**')]);
      if (config.depending.next) {
        settings = merge.all([settings, excludeSetting('**/.next/**')]);
      }
      sortKeys(settings ?? {});
      const newContent = JSON.stringify(settings, undefined, 2);
      await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
    } catch {
      // do nothing
    }
  });
}
