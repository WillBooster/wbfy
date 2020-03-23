import path from 'path';
import fse from 'fs-extra';
import merge from 'deepmerge';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const jsonObj = {
  hooks: {
    'pre-commit': 'lint-staged',
    'pre-push': 'yarn typecheck',
  },
};

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
  let newJsonObj: any = Object.assign({}, jsonObj);
  if (!config.containingTypeScript) {
    delete newJsonObj.hooks['pre-push'];
  }

  const filePath = path.resolve(config.dirPath, '.huskyrc.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj]);
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(newJsonObj));
}
