import path from 'path';

import { FsUtil } from '../utils/fsUtil';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../utils/packageConfig';

import fetch from 'node-fetch';

const defaultNames = ['windows', 'macos', 'linux', 'jetbrains', 'visualstudiocode', 'emacs', 'vim'];

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
.devcontainer/
dist/
temp/
Icon[\r]
`;

export async function generateGitignore(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.gitignore');
  let userContent = (IgnoreFileUtil.getUserContent(filePath) || defaultUserContent) + commonContent;

  const names = [...defaultNames];
  if (config.containingYarnrcYml) {
    names.push('yarn');
  }
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
    names.push('flutter', 'AndroidStudio', 'ruby');
    userContent += `.flutter-plugins-dependencies
android/key.properties
ios/.bundle
.idea/runConfigurations.xml
`;
  }
  if (config.containingTemplateYaml) {
    userContent += `.aws-sam/
packaged.yaml
`;
  }
  // Because .venv should be ignored on root directory
  if (config.containingPoetryLock) {
    names.push('python');
  }
  if (rootConfig.depending.firebase || config.depending.firebase) {
    names.push('firebase');
  }
  if (rootConfig.depending.reactNative || config.depending.reactNative) {
    names.push('reactnative');
    userContent += `google-services.json
android/app/src/main/assets/
`;
  }

  let content = (
    await Promise.all(
      names.map(async (name) => {
        const response = await fetch(`https://www.toptal.com/developers/gitignore/api/${name}`);
        return await response.text();
      })
    )
  ).join('');
  if (config.containingYarnrcYml && !IgnoreFileUtil.isBerryZeroInstallEnabled(filePath)) {
    content = content.replace('!.yarn/cache', '# !.yarn/cache').replace('# .pnp.*', '.pnp.*');
  }
  if (config.containingPomXml || config.containingPubspecYaml) {
    content = content
      .replace(/^# .idea\/artifacts$/gm, '.idea/artifacts')
      .replace(/^# .idea\/compiler.xml$/gm, '.idea/compiler.xml')
      .replace(/^# .idea\/jarRepositories.xml$/gm, '.idea/jarRepositories.xml')
      .replace(/^# .idea\/modules.xml$/gm, '.idea/modules.xml')
      .replace(/^# .idea\/*.iml$/gm, '.idea/*.iml')
      .replace(/^# .idea\/modules$/gm, '.idea/modules')
      .replace(/^# *.iml$/gm, '*.iml')
      .replace(/^# *.ipr$/gm, '*.ipr');
    if (config.containingPubspecYaml) {
      content = content.replace(/^.idea\/modules.xml$/gm, '# .idea/modules.xml');
    }
  }
  content = content.replace(/^.idea\/?$/gm, '# .idea');
  if (rootConfig.depending.reactNative || config.depending.reactNative || config.containingPubspecYaml) {
    content = content.replace(/^(.idea\/.+)$/gm, '$1\nandroid/$1');
  }
  await FsUtil.generateFile(filePath, userContent + content);
}
