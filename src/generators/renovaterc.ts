import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import merge from 'deepmerge';

import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';

const jsonObj = {
  extends: ['@willbooster'],
};

export async function generateRenovateJson(config: PackageConfig): Promise<void> {
  let newJsonObj: any = Object.assign({}, jsonObj);

  const filePath = path.resolve(config.dirPath, '.renovaterc.json');
  if (fs.existsSync(filePath)) {
    const existingContent = (await fsp.readFile(filePath)).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent) as any;
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj], { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  await Promise.all([
    fsp.rm(path.resolve(config.dirPath, '.dependabot'), { force: true }),
    fsp.rm(path.resolve(config.dirPath, 'renovate.json'), { force: true }),
    FsUtil.generateFile(filePath, JSON.stringify(newJsonObj)),
  ]);
}
