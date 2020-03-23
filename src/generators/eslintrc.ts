import path from 'path';
import merge from 'deepmerge';
import fse from 'fs-extra';
import { PackageConfig } from '../utils/packageConfig';
import { combineMerge } from '../utils/mergeUtil';
import { FsUtil } from '../utils/fsUtil';

function getExtensionBase(config: PackageConfig): string {
  if (config.containingTypeScript) {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-ts-react';
    } else {
      return '@willbooster/eslint-config-ts';
    }
  } else {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-js-react';
    } else {
      return '@willbooster/eslint-config-js';
    }
  }
}

export async function generateEslintrc(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  const eslintBase = getExtensionBase(config);
  config.eslintBase = rootConfig.eslintBase === eslintBase ? '../../.eslintrc.json' : eslintBase;
  let newJsonObj: any = { root: true, extends: [config.eslintBase] };

  const filePath = path.resolve(config.dirPath, '.eslintrc.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      if (existingJsonObj.extends) {
        existingJsonObj.extends = existingJsonObj.extends.filter((ext: string) => !ext.startsWith('@willbooster/'));
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
