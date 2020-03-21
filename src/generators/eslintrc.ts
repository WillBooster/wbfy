import path from 'path';
import { PackageConfig } from '../utils/packageConfig';
import { overwriteMerge } from '../utils/mergeUtil';
import { FsUtil } from '../utils/fsUtil';
import merge from 'deepmerge';
import fse from 'fs-extra';

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
  let jsonObj: any = { root: true, extends: [config.eslintBase] };

  const filePath = path.resolve(config.dirPath, '.eslintrc.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      jsonObj = merge.all([jsonObj, existingJsonObj, jsonObj], { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(jsonObj));
}
