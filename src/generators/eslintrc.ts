import fs from 'fs';
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
  let newJsonObj: any = { root: true, extends: bases };

  const filePath = path.resolve(config.dirPath, '.eslintrc.json');
  if (fs.existsSync(filePath)) {
    const existingContent = await fsp.readFile(filePath, 'utf-8');
    try {
      const existingJsonObj = JSON.parse(existingContent);
      if (existingJsonObj.extends) {
        existingJsonObj.extends = existingJsonObj.extends.filter(
          (ext: string) => !ext.startsWith('@willbooster/') && ext !== '../../.eslintrc.json'
        );
      }
      if (!bases.length) {
        existingJsonObj.extends = [];
      }
      const newExtends = newJsonObj.extends;
      newJsonObj.extends = existingJsonObj.extends;
      existingJsonObj.extends = newExtends;
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj], { arrayMerge: combineMerge });
      if (config.depending.blitz) {
        newJsonObj.extends = [...newJsonObj.extends.filter((e: string) => e !== 'blitz'), 'blitz'];
      }
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(newJsonObj));
}
