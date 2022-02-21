import fsp from 'fs/promises';
import path from 'path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';

import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';

const jsonObj = {
  extends: ['@willbooster'],
};

export async function generateRenovateJson(config: PackageConfig): Promise<void> {
  let newSettings: any = cloneDeep(jsonObj);

  const filePath = path.resolve(config.dirPath, '.renovaterc.json');
  const oldContent = await fsp.readFile(filePath, 'utf-8');
  try {
    const oldSettings = JSON.parse(oldContent) as any;
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: overwriteMerge });
  } catch (e) {
    // do nothing
  }
  await Promise.all([
    fsp.rm(path.resolve(config.dirPath, '.dependabot'), { force: true }),
    fsp.rm(path.resolve(config.dirPath, 'renovate.json'), { force: true }),
    FsUtil.generateFile(filePath, JSON.stringify(newSettings)),
  ]);
}
