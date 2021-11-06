import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import merge from 'deepmerge';

import { FsUtil } from '../utils/fsUtil';
import { combineMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';

function getExtensionBase(config: PackageConfig): string | undefined {
  if (config.containingTypeScript) {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-ts-react';
    } else {
      return '@willbooster/eslint-config-ts';
    }
  } else {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-js-react';
    } else if (config.containingJavaScript) {
      return '@willbooster/eslint-config-js';
    }
  }
  return undefined;
}

export async function generateEslintrc(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  const bases = [];
  config.eslintBase = getExtensionBase(config);
  if (config.eslintBase) {
    bases.push(config.eslintBase);
  }
  if (config !== rootConfig) {
    bases.push('../../.eslintrc.json');
  }
  let newJsonObj: any = { root: true, extends: bases };

  const filePath = path.resolve(config.dirPath, '.eslintrc.json');
  if (fs.existsSync(filePath)) {
    const existingContent = (await fsp.readFile(filePath)).toString();
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
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(newJsonObj));
}
