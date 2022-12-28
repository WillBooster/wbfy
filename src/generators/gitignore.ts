import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logger } from '../logger';
import { options } from '../options';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { ignoreFileUtil } from '../utils/ignoreFileUtil';
import { promisePool } from '../utils/promisePool';

const defaultNames = ['windows', 'macos', 'linux', 'jetbrains', 'visualstudiocode', 'emacs', 'vim', 'yarn'];

const commonContent = `
.devcontainer/
.venv/
dist/
temp/
Icon[\r]
*.sqlite3
*.sqlite3-journal
`;

export async function generateGitignore(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  return logger.function('generateGitignore', async () => {
    const filePath = path.resolve(config.dirPath, '.gitignore');
    const content = (await FsUtil.readFileIgnoringError(filePath)) ?? '';
    let headUserContent = ignoreFileUtil.getHeadUserContent(content) + commonContent;
    const tailUserContent = ignoreFileUtil.getTailUserContent(content);

    const names = [...defaultNames];
    if (config.containingGemfile) {
      names.push('ruby');
    }
    if (config.containingGoMod) {
      names.push('go');
      headUserContent += `${path.basename(config.dirPath)}
`;
    }
    if (config.containingPackageJson) {
      names.push('node');
    }
    if (config.containingPomXml) {
      names.push('maven');
      headUserContent += `.idea/google-java-format.xml
`;
    }
    if (config.containingPubspecYaml) {
      names.push('flutter', 'AndroidStudio', 'ruby');
      headUserContent += `.flutter-plugins-dependencies
android/key.properties
ios/.bundle
.idea/runConfigurations.xml
`;
    }
    if (config.containingTemplateYaml) {
      headUserContent += `.aws-sam/
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
      headUserContent += `google-services.json
android/app/src/main/assets/
`;
    }
    if (rootConfig.depending.storybook) {
      names.push('storybookjs');
    }
    if (rootConfig.depending.blitz) {
      names.push('nextjs');
      headUserContent += `.blitz/
.blitz**
`;
    }

    let generated = '';
    for (const name of names) {
      let content = (await readCache(name)) ?? '';
      if (!content) {
        const url = `https://www.toptal.com/developers/gitignore/api/${name}`;
        const response = await fetch(url);
        const responseText = await response.text();
        if (responseText.includes('Attention Required!')) {
          console.error(`Failed to fetch ${url}`);
          return;
        }
        content = responseText.trim();
        await promisePool.run(() => writeCache(name, content));
        if (options.isVerbose) {
          console.info(`Fetched ${url}`);
        }
      }
      if (generated) generated += '\n';
      generated += content + '\n';
    }
    if (!(await ignoreFileUtil.isBerryZeroInstallEnabled(filePath))) {
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
    const newContent = headUserContent + generated + tailUserContent;
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}

const dirPath = path.join(os.homedir(), '.cache', 'wbfy', 'gitignore');

async function writeCache(name: string, content: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
  await fs.promises.writeFile(path.join(dirPath, name), content);
}

async function readCache(name: string): Promise<string | undefined> {
  try {
    const stat = await fs.promises.stat(path.join(dirPath, name));
    if (Date.now() - stat.mtimeMs > 6 * 60 * 60 * 1000) {
      return;
    }
    return await fs.promises.readFile(path.join(dirPath, name), 'utf8');
  } catch {
    // do nothing
  }
}
