import fs from 'fs';
import path from 'path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { promisePool } from '../utils/promisePool';
import { spawnSync } from '../utils/spawnUtil';

const DEFAULT_COMMAND = 'npm test';

const settings = {
  preCommit: 'yarn lint-staged',
  prePush: `yarn typecheck`,
  prePushForLab: `
if [ $(git branch --show-current) = "main" ] && [ $(git config user.email) != "exkazuu@gmail.com" ]; then
  echo "************************************************"
  echo "*** Don't push main branch directly. Use PR! ***"
  echo "************************************************"
  exit 1
fi

yarn typecheck`.trim(),
  postMerge: 'yarn',
};

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
  return logger.function('generateHuskyrc', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const packageJsonPath = path.resolve(config.dirPath, 'package.json');
  const jsonText = await fs.promises.readFile(packageJsonPath, 'utf-8');
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
  const content = await fs.promises.readFile(preCommitFilePath, 'utf-8');

  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.huskyrc.json'), { force: true }));
  await promisePool.run(() =>
    fs.promises.writeFile(preCommitFilePath, content.replace(DEFAULT_COMMAND, settings.preCommit))
  );

  if (config.containingTypeScript || config.containingTypeScriptInPackages) {
    const prePush = config.repository?.startsWith('github:WillBoosterLab/') ? settings.prePushForLab : settings.prePush;
    await promisePool.run(() =>
      fs.promises.writeFile(path.resolve(dirPath, 'pre-push'), content.replace(DEFAULT_COMMAND, prePush), {
        mode: 0o755,
      })
    );
  }

  const postMergeCommands: string[] = [];
  if (config.versionsText?.includes('python ')) {
    postMergeCommands.push('asdf install python');
  }
  if (config.versionsText) {
    postMergeCommands.push('asdf install');
  }
  postMergeCommands.push(settings.postMerge);
  if (config.containingPoetryLock) {
    postMergeCommands.push('poetry install');
  }
  if (config.depending.blitz || config.depending.prisma) {
    postMergeCommands.push('yarn gen-code');
  }
  const postMergeCommand = content.replace(DEFAULT_COMMAND, postMergeCommands.join(' && '));
  await promisePool.run(() =>
    fs.promises.writeFile(path.resolve(dirPath, 'post-merge'), postMergeCommand, {
      mode: 0o755,
    })
  );
}
