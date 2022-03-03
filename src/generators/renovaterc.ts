import fs from 'fs';
import path from 'path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';

import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

const jsonObj = {
  extends: ['@willbooster'],
};

export async function generateRenovateJson(config: PackageConfig): Promise<void> {
  let newSettings: any = cloneDeep(jsonObj);

  const filePath = path.resolve(config.dirPath, '.renovaterc.json');
  try {
    const oldContent = await fs.promises.readFile(filePath, 'utf-8');
    const oldSettings = JSON.parse(oldContent) as any;
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: overwriteMerge });
  } catch (e) {
    // do nothing
  }
  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.dependabot'), { force: true }));
  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, 'renovate.json'), { force: true }));
  const newContent = JSON.stringify(newSettings);
  await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
}
