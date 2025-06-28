import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { overwriteMerge } from '../utils/mergeUtil.js';
import { promisePool } from '../utils/promisePool.js';

const defaultSettings = {
  contextFileName: 'AGENTS.md',
};

export async function generateGeminiSettings(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateGeminiSettings', async () => {
    if (!config.isRoot) return;

    const dirPath = path.resolve(config.dirPath, '.gemini');
    const filePath = path.resolve(dirPath, 'settings.json');

    let newSettings: object = cloneDeep(defaultSettings);
    try {
      const oldContent = await fs.promises.readFile(filePath, 'utf8');
      const oldSettings = JSON.parse(oldContent) as object;
      newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: overwriteMerge });
    } catch {
      // do nothing
    }

    const newContent = JSON.stringify(newSettings, undefined, 2);
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
