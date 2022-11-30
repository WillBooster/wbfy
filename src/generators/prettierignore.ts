import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { promisePool } from '../utils/promisePool';

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
    const content = (await FsUtil.readFileIgnoringError(filePath)) ?? '';
    const headUserContent = IgnoreFileUtil.getHeadUserContent(content) + commonContent;
    const tailUserContent = IgnoreFileUtil.getTailUserContent(content);

    const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
    const gitignoreContent = (await IgnoreFileUtil.readGitignoreWithoutSeparators(gitignoreFilePath)) || '';

    let additionalContent = '';
    if (config.containingPubspecYaml) {
      additionalContent = `
android/app/
ios/Runner/Assets.xcassets/
pubspec.yaml
`;
    }

    const newContent = headUserContent + commonContent + additionalContent + gitignoreContent + tailUserContent;
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
