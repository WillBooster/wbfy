import path from 'path';

import { logger } from '../logger';
import { FsUtil } from '../utils/fsUtil';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
3rd-party/
android/
ios/
no-format/
test-fixtures/
*.d.ts
*.min.js
.yarn/
.pnp.js
`;

export async function generatePrettierignore(config: PackageConfig): Promise<void> {
  return logger.function('generatePrettierignore', async () => {
    const filePath = path.resolve(config.dirPath, '.prettierignore');
    const userContent = (await IgnoreFileUtil.getUserContent(filePath)) || defaultUserContent;

    const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
    const gitignoreContent = (await IgnoreFileUtil.getExistingContent(gitignoreFilePath)) || '';

    let additionalContent = '';
    if (config.containingPubspecYaml) {
      additionalContent = `
android/app/
ios/Runner/Assets.xcassets/
pubspec.yaml
`;
    }

    const newContent = userContent + commonContent + additionalContent + gitignoreContent;
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
