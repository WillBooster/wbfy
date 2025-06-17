import fs from 'node:fs';
import path from 'node:path';

import type { PackageJson } from 'type-fest';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync } from '../utils/spawnUtil.js';

import { generateScripts } from './packageJson.js';

const scripts = {
  preCommit: 'node node_modules/.bin/lint-staged',
  prePush: `yarn typecheck`,
  prePushForLab: `
if [ $(git branch --show-current) = "main" ] && [ $(git config user.email) != "exkazuu@gmail.com" ]; then
  echo "************************************************"
  echo "*** Don't push main branch directly. Use PR! ***"
  echo "************************************************"
  exit 1
fi

yarn typecheck
`.trim(),
  postMerge: `
changed_files="$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)"

run_if_changed() {
  if echo "$changed_files" | grep --quiet -E "$1"; then
    eval "$2"
  fi
}
`.trim(),
};

export async function generateHuskyrcUpdatingPackageJson(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateHuskyrcUpdatingPackageJson', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const packageJsonPath = path.resolve(config.dirPath, 'package.json');
  const jsonText = await fs.promises.readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(jsonText) as PackageJson;
  packageJson.scripts ||= {};
  delete packageJson.scripts['postinstall'];
  delete packageJson.scripts['postpublish'];
  delete packageJson.scripts['prepare'];
  delete packageJson.scripts['prepublishOnly'];
  delete packageJson.scripts['prepack'];
  delete packageJson.scripts['postpack'];

  const dirPath = path.resolve(config.dirPath, '.husky');
  await Promise.all([
    fs.promises.writeFile(packageJsonPath, JSON.stringify(packageJson, undefined, 2)),
    fs.promises.rm(dirPath, { force: true, recursive: true }),
  ]);
  if (config.isBun) {
    spawnSync('git', ['config', '--unset', 'core.hooksPath'], config.dirPath);
    return;
  }

  spawnSync('yarn', ['dlx', 'husky-init', '--yarn2'], config.dirPath);

  const preCommitFilePath = path.resolve(dirPath, 'pre-commit');

  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.huskyrc.json'), { force: true }));
  await promisePool.run(() => fs.promises.writeFile(preCommitFilePath, scripts.preCommit + '\n'));

  const { typecheck } = generateScripts(config);
  if (typecheck) {
    let prePush =
      config.repository?.startsWith('github:WillBoosterLab/') &&
      !config.repository?.toLocaleLowerCase().includes('exercode')
        ? scripts.prePushForLab
        : scripts.prePush;
    prePush = prePush.replace(
      'yarn typecheck',
      typecheck
        .replace('tsc ', 'node node_modules/.bin/tsc ')
        .replace('wb ', 'node node_modules/.bin/wb ')
        // pyright has no arguments
        .replace('pyright', 'node node_modules/.bin/pyright')
    );
    await promisePool.run(() =>
      fs.promises.writeFile(path.resolve(dirPath, 'pre-push'), prePush + '\n', {
        mode: 0o755,
      })
    );
  }
  const postMergeCommand = `${scripts.postMerge}\n\n${generatePostMergeCommands(config).join('\n')}\n`;
  await promisePool.run(() =>
    fs.promises.writeFile(path.resolve(dirPath, 'post-merge'), postMergeCommand, {
      mode: 0o755,
    })
  );
}

export function generatePostMergeCommands(config: PackageConfig): string[] {
  const postMergeCommands: string[] = [];
  if (config.versionsText) {
    postMergeCommands.push(
      String.raw`run_if_changed "\..+-version" "awk '{print \$1}' .tool-versions | xargs -I{} asdf plugin add {}"`,
      String.raw`run_if_changed "\..+-version" "asdf plugin update --all"`
    );
  }
  // Pythonがないとインストールできない処理系が存在するため、強制的に最初にインストールする。
  if (config.versionsText?.includes('python ')) {
    postMergeCommands.push(String.raw`run_if_changed "\..+-version" "asdf install python"`);
  }
  if (config.versionsText) {
    postMergeCommands.push(String.raw`run_if_changed "\..+-version" "asdf install"`);
  }
  const installCommand = config.isBun ? 'bun install' : 'yarn';
  const rmNextDirectory = config.depending.blitz || config.depending.next ? ' && rm -Rf .next' : '';
  postMergeCommands.push(`run_if_changed "package\\.json" "${installCommand}${rmNextDirectory}"`);
  if (config.doesContainsPoetryLock) {
    postMergeCommands.push(String.raw`run_if_changed "poetry\.lock" "poetry install"`);
  }
  if (config.depending.blitz) {
    postMergeCommands.push(
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/blitz prisma migrate deploy"`,
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/blitz prisma generate"`,
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/blitz codegen"`
    );
  } else if (config.depending.prisma) {
    postMergeCommands.push(
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/dotenv -c development -- node node_modules/.bin/prisma migrate deploy"`,
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/dotenv -c development -- node node_modules/.bin/prisma generate"`
    );
  }
  return postMergeCommands;
}
