import fsp from 'fs/promises';
import path from 'path';

import merge from 'deepmerge';

import { FsUtil } from '../utils/fsUtil';
import { combineMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';

export async function generateEslintrc(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
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
    const oldContent = await fsp.readFile(filePath, 'utf-8');
    const oldSettings = JSON.parse(oldContent);
    if (oldSettings.extends) {
      oldSettings.extends = oldSettings.extends.filter(
        (ext: string) => !ext.startsWith('@willbooster/') && ext !== '../../.eslintrc.json'
      );
    }
    if (!bases.length) {
      oldSettings.extends = [];
    }
    const newExtends = newSettings.extends;
    newSettings.extends = oldSettings.extends;
    oldSettings.extends = newExtends;
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
    if (config.depending.blitz) {
      newSettings.extends = [...newSettings.extends.filter((e: string) => e !== 'blitz'), 'blitz'];
    }
  } catch (e) {
    // do nothing
  }
  await FsUtil.generateFile(filePath, JSON.stringify(newSettings));
}
