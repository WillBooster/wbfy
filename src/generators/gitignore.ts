import path from 'path';
import fetch from 'node-fetch';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const defaultNames = ['windows', 'macos', 'linux', 'jetbrains', 'visualstudiocode', 'emacs', 'vim'];

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
.devcontainer/
dist/
inter/
temp/
`;

export async function generateGitignore(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.gitignore');
  let userContent = (IgnoreFileUtil.getUserContent(filePath) || defaultUserContent) + commonContent;

  const names = [...defaultNames];
  if (config.containingGemfile) {
    names.push('ruby');
  }
  if (config.containingGoMod) {
    names.push('go');
    userContent += `${path.basename(config.dirPath)}
`;
  }
  if (config.containingPackageJson) {
    names.push('node');
  }
  if (config.containingPomXml) {
    names.push('maven');
    userContent += `.idea/google-java-format.xml
`;
  }
  if (config.containingPubspecYaml) {
    names.push('flutter', 'ruby');
    userContent += `.flutter-plugins-dependencies
android/key.properties
ios/.bundle
`;
  }
  if (config.containingTemplateYaml) {
    userContent += `.aws-sam/
packaged.yaml
`;
  }
  if (rootConfig.depending.firebase || config.depending.firebase) {
    names.push('firebase');
  }

  const response = await fetch(`https://www.gitignore.io/api/${names.join(',')}`);
  let content = (await response.text()).replace('public/', '# public/');
  if (config.containingPomXml) {
    content = content
      .replace('# .idea/misc.xml', '.idea/misc.xml')
      .replace('# .idea/modules.xml', '.idea/modules.xml')
      .replace('# .idea/*.iml', '.idea/*.iml')
      .replace('# .idea/modules', '.idea/modules')
      .replace('# *.iml', '*.iml')
      .replace('# *.ipr', '*.ipr');
  }
  await FsUtil.generateFile(filePath, userContent + content);
}
