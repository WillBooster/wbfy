import fs from 'fs';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';
import { spawnSync } from '../utils/spawnUtil';

const DEFAULT_COMMAND = 'npm test';

const settings = {
  preCommit: 'yarn lint-staged',
  prePush: 'yarn typecheck',
  postMerge: 'yarn',
};

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
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
    await promisePool.run(() =>
      fs.promises.writeFile(path.resolve(dirPath, 'pre-push'), content.replace(DEFAULT_COMMAND, settings.prePush), {
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
  if (config.versionsText?.includes('poetry ')) {
    postMergeCommands.push('poetry install');
  }
  if (config.depending.blitz) {
    postMergeCommands.push('yarn blitz codegen');
  } else if (config.depending.prisma) {
    postMergeCommands.push('yarn prisma generate');
  }
  const postMergeCommand = content.replace(DEFAULT_COMMAND, postMergeCommands.join(' && '));
  await promisePool.run(() =>
    fs.promises.writeFile(path.resolve(dirPath, 'post-merge'), postMergeCommand, {
      mode: 0o755,
    })
  );
}
