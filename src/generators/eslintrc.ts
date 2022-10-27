import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { combineMerge } from '../utils/mergeUtil';
import { promisePool } from '../utils/promisePool';

export async function generateEslintrc(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  return logger.function('generateEslintrc', async () => {
    // TODO: support Blitz v2
    if (rootConfig.depending.blitz === '2') return;

    const bases = [];
    if (config.eslintBase) {
      bases.push(config.eslintBase);
    }
    if (config !== rootConfig) {
      bases.push('../../.eslintrc.json');
    }
    let newSettings: any = { root: true, extends: bases };

    const filePath = path.resolve(config.dirPath, '.eslintrc.json');
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
      newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
      if (config.depending.blitz === '0') {
        addExtensionToHead(newSettings, 'blitz');
      } else if (config.depending.blitz === '2') {
        addExtensionToHead(newSettings, '@blitzjs/next/eslint');
      }
    } catch {
      // do nothing
    }
    const newContent = JSON.stringify(newSettings);
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}

function addExtensionToHead(newSettings: any, extension: string): void {
  newSettings.extends = [extension, ...newSettings.extends.filter((e: string) => e !== extension)];
}
