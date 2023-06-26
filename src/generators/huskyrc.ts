import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync } from '../utils/spawnUtil.js';

import { generateScripts } from './packageJson.js';

const DEFAULT_COMMAND = 'npm test';

const settings = {
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

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
  return logger.function('generateHuskyrc', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const packageJsonPath = path.resolve(config.dirPath, 'package.json');
  const jsonText = await fs.promises.readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(jsonText);
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
  spawnSync('yarn', ['dlx', 'husky-init', '--yarn2'], config.dirPath);

  const preCommitFilePath = path.resolve(dirPath, 'pre-commit');
  const content = await fs.promises.readFile(preCommitFilePath, 'utf8');

  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.huskyrc.json'), { force: true }));
  await promisePool.run(() =>
    fs.promises.writeFile(preCommitFilePath, content.replace(DEFAULT_COMMAND, settings.preCommit))
  );

  const { typecheck } = generateScripts(config);
  if (typecheck) {
    let prePush = config.repository?.startsWith('github:WillBoosterLab/') ? settings.prePushForLab : settings.prePush;
    prePush = prePush.replace(
      'yarn typecheck',
      typecheck
        .replace('tsc ', 'node node_modules/.bin/tsc ')
        .replace('wb ', 'node node_modules/.bin/wb ')
        // pyright has no arguments
        .replace('pyright', 'node node_modules/.bin/pyright')
    );
    await promisePool.run(() =>
      fs.promises.writeFile(path.resolve(dirPath, 'pre-push'), content.replace(DEFAULT_COMMAND, prePush), {
        mode: 0o755,
      })
    );
  }

  const postMergeCommands: string[] = [];
  if (config.versionsText) {
    postMergeCommands.push('run_if_changed "\\..+-version" "asdf plugin update --all"');
  }
  // Pythonがないとインストールできない処理系が存在するため、強制的に最初にインストールする。
  if (config.versionsText?.includes('python ')) {
    postMergeCommands.push('run_if_changed "\\..+-version" "asdf install python"');
  }
  if (config.versionsText) {
    postMergeCommands.push('run_if_changed "\\..+-version" "asdf install"');
  }
  const rmNextDirectory = config.depending.blitz ? ' && rm -Rf .next' : '';
  postMergeCommands.push(`run_if_changed "package\\.json" "yarn${rmNextDirectory}"`);
  if (config.containingPoetryLock) {
    postMergeCommands.push('run_if_changed "poetry\\.lock" "poetry install"');
  }
  if (config.depending.blitz) {
    postMergeCommands.push(
      'run_if_changed "db/schema.prisma" "node node_modules/.bin/blitz prisma migrate deploy"',
      'run_if_changed "db/schema.prisma" "node node_modules/.bin/blitz prisma generate"',
      'run_if_changed "db/schema.prisma" "node node_modules/.bin/blitz codegen"'
    );
  } else if (config.depending.prisma) {
    postMergeCommands.push(
      'run_if_changed "prisma/schema.prisma" "node node_modules/.bin/dotenv -c development -- node node_modules/.bin/prisma migrate deploy"',
      'run_if_changed "prisma/schema.prisma" "node node_modules/.bin/dotenv -c development -- node node_modules/.bin/prisma generate"'
    );
  }
  const postMergeCommand = content.replace(DEFAULT_COMMAND, `${settings.postMerge}\n\n${postMergeCommands.join('\n')}`);
  await promisePool.run(() =>
    fs.promises.writeFile(path.resolve(dirPath, 'post-merge'), postMergeCommand, {
      mode: 0o755,
    })
  );
}
