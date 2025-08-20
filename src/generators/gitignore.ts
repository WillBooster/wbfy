import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logger } from '../logger.js';
import { options } from '../options.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { ignoreFileUtil } from '../utils/ignoreFileUtil.js';
import { promisePool } from '../utils/promisePool.js';

const defaultNames = ['windows', 'macos', 'linux', 'jetbrains', 'visualstudiocode', 'emacs', 'vim', 'yarn'];

const commonContent = `
!.keep
.aider*
.env.production
*/mount/*.hash
.devcontainer/
.idea/AugmentWebviewStateStore.xml
.idea/copilot/chatSessions/
.serena/
.tmp/
__generated__/
dist/
temp/
tmp/
`;

export async function generateGitignore(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateGitignore', async () => {
    const filePath = path.resolve(config.dirPath, '.gitignore');
    const content = (await fsUtil.readFileIgnoringError(filePath)) ?? '';
    let headUserContent = ignoreFileUtil.getHeadUserContent(content) + commonContent;
    const tailUserContent = ignoreFileUtil.getTailUserContent(content);

    const names = [...defaultNames];
    if (config.doesContainsGemfile) {
      names.push('ruby');
    }
    if (config.doesContainsGoMod) {
      names.push('go');
      headUserContent += `${path.basename(config.dirPath)}
`;
    }
    if (config.doesContainsPackageJson) {
      names.push('node');
    }
    if (config.doesContainsPomXml) {
      names.push('maven');
      headUserContent += `.idea/google-java-format.xml
`;
    }
    if (config.doesContainsPubspecYaml) {
      names.push('flutter', 'AndroidStudio', 'ruby');
      headUserContent += `.flutter-plugins-dependencies
android/key.properties
ios/.bundle
.idea/runConfigurations.xml
`;
    }
    if (config.doesContainsTemplateYaml) {
      headUserContent += `.aws-sam/
packaged.yaml
`;
    }
    // Because .venv should be ignored on root directory
    if (config.doesContainsPoetryLock) {
      names.push('python');
      headUserContent += `.venv/
`;
    }

    if (config.depending.blitz) {
      headUserContent += `.blitz/
.blitz**
`;
    }
    if (config.depending.next) {
      names.push('nextjs');
    }
    if (rootConfig.depending.firebase || config.depending.firebase) {
      names.push('firebase');
    }
    if (config.depending.prisma) {
      headUserContent += `*.sqlite3*
`;
    }
    if (config.depending.playwrightTest) {
      headUserContent += `test-results/
`;
    }
    if (rootConfig.depending.reactNative || config.depending.reactNative) {
      names.push('reactnative');
      headUserContent += `google-services.json
android/app/src/main/assets/
`;
    }
    if (config.depending.storybook) {
      names.push('storybookjs');
    }
    if (config.depending.litestream) {
      headUserContent += `gcp-sa-key.json
`;
    }

    let generated = '';
    for (const name of names) {
      let content = (await readCache(name)) ?? '';
      if (!content) {
        const url = `https://www.toptal.com/developers/gitignore/api/${name}`;
        const response = await fetch(url);
        const responseText = await response.text();
        if (!response.ok || responseText.includes('Attention Required!') || responseText.includes('<title>')) {
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
    if (config.doesContainsPomXml || config.doesContainsPubspecYaml) {
      generated = generated
        .replaceAll(/^# .idea\/artifacts$/gm, '.idea/artifacts')
        .replaceAll(/^# .idea\/compiler.xml$/gm, '.idea/compiler.xml')
        .replaceAll(/^# .idea\/jarRepositories.xml$/gm, '.idea/jarRepositories.xml')
        .replaceAll(/^# .idea\/modules.xml$/gm, '.idea/modules.xml')
        .replaceAll(/^# .idea\/*.iml$/gm, '.idea/*.iml')
        .replaceAll(/^# .idea\/modules$/gm, '.idea/modules')
        .replaceAll(/^# *.iml$/gm, '*.iml')
        .replaceAll(/^# *.ipr$/gm, '*.ipr');
      if (config.doesContainsPubspecYaml) {
        generated = generated.replaceAll(/^.idea\/modules.xml$/gm, '# .idea/modules.xml');
      }
    }
    generated = generated.replaceAll(/^.idea\/?$/gm, '# .idea');
    if (rootConfig.depending.reactNative || config.depending.reactNative || config.doesContainsPubspecYaml) {
      generated = generated.replaceAll(/^(.idea\/.+)$/gm, '$1\nandroid/$1');
    }
    const newContent = headUserContent + '\n' + generated + (tailUserContent ?? '');
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
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
