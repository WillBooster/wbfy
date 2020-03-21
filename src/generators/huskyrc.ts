import path from 'path';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import fse from 'fs-extra';
import merge from 'deepmerge';

function generateJsonObj(): any {
  return {
    hooks: {
      'pre-commit': 'lint-staged',
      'pre-push': 'yarn typecheck',
    },
  };
}

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
  let jsonObj = generateJsonObj();
  if (!config.containingTypeScript) {
    delete jsonObj.hooks['pre-push'];
  }

  const filePath = path.resolve(config.dirPath, '.huskyrc.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      jsonObj = merge.all([jsonObj, existingJsonObj, jsonObj]);
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(jsonObj));
}
