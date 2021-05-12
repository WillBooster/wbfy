import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import merge from 'deepmerge';

import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';

const jsonObj = {
  packages: ['packages/*'],
  version: '1.0.0',
  npmClient: 'yarn',
  useWorkspaces: true,
  publishConfig: {
    access: 'public',
  },
};

export async function generateLernaJson(config: PackageConfig): Promise<void> {
  let newJsonObj: any = Object.assign({}, jsonObj);

  const filePath = path.resolve(config.dirPath, 'lerna.json');
  if (fs.existsSync(filePath)) {
    const existingContent = (await fsp.readFile(filePath)).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent) as any;
      const version = existingJsonObj.version;
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj], { arrayMerge: overwriteMerge });
      newJsonObj.version = version || newJsonObj.version;
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(newJsonObj));
}
