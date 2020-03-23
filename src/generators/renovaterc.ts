import path from 'path';
import fse from 'fs-extra';
import merge from 'deepmerge';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';

const jsonObj = {
  extends: ['@willbooster'],
};

export async function generateRenovateJson(config: PackageConfig): Promise<void> {
  let newJsonObj: any = Object.assign({}, jsonObj);

  const filePath = path.resolve(config.dirPath, '.renovaterc.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent) as any;
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj], { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  await Promise.all([
    fse.remove(path.resolve(config.dirPath, '.dependabot')),
    fse.remove(path.resolve(config.dirPath, 'renovate.json')),
    FsUtil.generateFile(filePath, JSON.stringify(newJsonObj)),
  ]);
}
