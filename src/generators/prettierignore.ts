import path from 'path';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';

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
`;

export async function generatePrettierignore(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.prettierignore');
  const userContent = IgnoreFileUtil.getUserContent(filePath) || defaultUserContent;

  const gitignoreFilePath = path.resolve(config.dirPath, '.gitignore');
  const gitignoreContent = IgnoreFileUtil.getExistingContent(gitignoreFilePath) || '';

  let additionalContent = '';
  if (config.containingPubspecYaml) {
    additionalContent = `
android/app/
ios/Runner/Assets.xcassets/
pubspec.yaml
`;
  }

  await FsUtil.generateFile(filePath, userContent + commonContent + additionalContent + gitignoreContent);
}
