import path from 'path';
import fse from 'fs-extra';
import merge from 'deepmerge';
import { overwriteMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';

function generateJsonObj(): any {
  return {
    packages: ['packages/*'],
    version: '1.0.0',
    npmClient: 'yarn',
    useWorkspaces: true,
    publishConfig: {
      access: 'public',
    },
  };
}

export async function generateLernaJson(config: PackageConfig): Promise<void> {
  let jsonObj = generateJsonObj();

  const filePath = path.resolve(config.dirPath, 'lerna.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent) as any;
      const version = existingJsonObj.version;
      jsonObj = merge.all([jsonObj, existingJsonObj, jsonObj], { arrayMerge: overwriteMerge });
      jsonObj.version = version || jsonObj.version;
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(jsonObj));
}
