import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { combineMerge } from '../utils/mergeUtil.js';
import { promisePool } from '../utils/promisePool.js';

export async function generateEslintrc(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateEslintrc', async () => {
    const filePath = path.resolve(config.dirPath, '.eslintrc.json');
    if (config.isBun) {
      await promisePool.run(() => fs.promises.rm(filePath, { force: true }));
      return;
    }

    const bases = [];
    if (config.eslintBase) {
      bases.push(config.eslintBase);
    }
    if (config !== rootConfig) {
      bases.push('../../.eslintrc.json');
    }
    let newSettings = { root: true, extends: bases };

    try {
      const oldContent = await fs.promises.readFile(filePath, 'utf8');
      const oldSettings = JSON.parse(oldContent);
      if (oldSettings.extends) {
        oldSettings.extends = oldSettings.extends.filter(
          (ext: string) => !ext.startsWith('@willbooster/') && ext !== '../../.eslintrc.json'
        );
      }
      if (bases.length === 0) {
        oldSettings.extends = [];
      }
      const newExtends = newSettings.extends;
      newSettings.extends = oldSettings.extends;
      oldSettings.extends = newExtends;
      newSettings = merge.all([newSettings, oldSettings, newSettings], {
        arrayMerge: combineMerge,
      }) as typeof newSettings;
      // TODO: Remove the following code after all Blitz.js projects are updated.
      if (config.depending.blitz) {
        newSettings.extends = newSettings.extends.filter(
          (ext: string) => ext !== './node_modules/@blitzjs/next/eslint'
        );
      }
    } catch {
      // do nothing
    }
    const newContent = JSON.stringify(newSettings);
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
