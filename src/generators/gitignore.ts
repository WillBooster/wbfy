import path from 'path';

import { fetchOnNode } from '../utils/fetchOnNode';
import { FsUtil } from '../utils/fsUtil';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../utils/packageConfig';

const defaultNames = ['windows', 'macos', 'linux', 'jetbrains', 'visualstudiocode', 'emacs', 'vim', 'yarn'];

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
.devcontainer/
dist/
temp/
Icon[\r]
*.sqlite3
*.sqlite3-journal
`;

const gitignoreCache = new Map<string, string>();

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
  if (rootConfig.depending.storybook) {
    names.push('storybookjs');
  }
  if (rootConfig.depending.blitz) {
    names.push('nextjs');
    userContent += `.blitz/
.blitz**
`;
  }

  let generated = '';
  for (const name of names) {
    if (!gitignoreCache.has(name)) {
      const url = `https://www.toptal.com/developers/gitignore/api/${name}`;
      const response = await fetchOnNode(url);
      const responseText = await response.text();
      if (responseText.includes('Attention Required!')) {
        console.error(`Failed to fetch ${url}`);
        return;
      }
      gitignoreCache.set(name, responseText);
    }
    generated += gitignoreCache.get(name);
  }
  if (!IgnoreFileUtil.isBerryZeroInstallEnabled(filePath)) {
    generated = generated.replace('!.yarn/cache', '# !.yarn/cache').replace('# .pnp.*', '.pnp.*');
  }
  if (config.containingPomXml || config.containingPubspecYaml) {
    generated = generated
      .replace(/^# .idea\/artifacts$/gm, '.idea/artifacts')
      .replace(/^# .idea\/compiler.xml$/gm, '.idea/compiler.xml')
      .replace(/^# .idea\/jarRepositories.xml$/gm, '.idea/jarRepositories.xml')
      .replace(/^# .idea\/modules.xml$/gm, '.idea/modules.xml')
      .replace(/^# .idea\/*.iml$/gm, '.idea/*.iml')
      .replace(/^# .idea\/modules$/gm, '.idea/modules')
      .replace(/^# *.iml$/gm, '*.iml')
      .replace(/^# *.ipr$/gm, '*.ipr');
    if (config.containingPubspecYaml) {
      generated = generated.replace(/^.idea\/modules.xml$/gm, '# .idea/modules.xml');
    }
  }
  generated = generated.replace(/^.idea\/?$/gm, '# .idea');
  if (rootConfig.depending.reactNative || config.depending.reactNative || config.containingPubspecYaml) {
    generated = generated.replace(/^(.idea\/.+)$/gm, '$1\nandroid/$1');
  }
  const newContent = userContent + generated;
  await FsUtil.generateFile(filePath, newContent);
}
