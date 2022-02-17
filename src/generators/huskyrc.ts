import fsp from 'fs/promises';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';
import { spawnSync } from '../utils/spawnUtil';

const DEFAULT_COMMAND = 'npm test';

const settings = {
  preCommit: 'yarn lint-staged',
  prePush: 'yarn typecheck',
  postMerge: 'yarn',
};

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
  const packageJsonPath = path.resolve(config.dirPath, 'package.json');
  const jsonText = await fsp.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(jsonText);
  packageJson.scripts ||= {};
  delete packageJson.scripts['postinstall'];
  delete packageJson.scripts['postpublish'];
  delete packageJson.scripts['prepare'];
  delete packageJson.scripts['prepublishOnly'];

  const dirPath = path.resolve(config.dirPath, '.husky');
  await Promise.all([
    fsp.writeFile(packageJsonPath, JSON.stringify(packageJson, undefined, 2)),
    fsp.rm(dirPath, { force: true, recursive: true }),
  ]);
  spawnSync('yarn', ['dlx', 'husky-init', '--yarn2'], config.dirPath);

  const preCommitFilePath = path.resolve(dirPath, 'pre-commit');
  const content = await fsp.readFile(preCommitFilePath, 'utf-8');

  const promises = [
    fsp.rm(path.resolve(config.dirPath, '.huskyrc.json'), { force: true }),
    fsp.writeFile(preCommitFilePath, content.replace(DEFAULT_COMMAND, settings.preCommit)),
  ];

  if (config.containingTypeScript || config.containingTypeScriptInPackages) {
    promises.push(
      fsp.writeFile(path.resolve(dirPath, 'pre-push'), content.replace(DEFAULT_COMMAND, settings.prePush), {
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
  promises.push(
    fsp.writeFile(path.resolve(dirPath, 'post-merge'), postMergeCommand, {
      mode: 0o755,
    })
  );

  await Promise.all(promises);
}
