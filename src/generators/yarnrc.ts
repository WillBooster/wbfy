import fsp from 'fs/promises';
import path from 'path';

import yaml from 'js-yaml';

import { PackageConfig } from '../utils/packageConfig';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil';

export async function generateYarnrcYml(config: PackageConfig): Promise<void> {
  const currentVersion = spawnSyncWithStringResult('yarn', ['--version'], config.dirPath);
  const latestVersion = spawnSyncWithStringResult('npm', ['show', '@yarnpkg/cli', 'version'], config.dirPath);
  if (currentVersion !== latestVersion) {
    spawnSync('yarn', ['set', 'version', latestVersion], config.dirPath);
  }

  const yarnrcPath = path.resolve(config.dirPath, '.yarnrc');
  fsp.rm(yarnrcPath, { force: true }).then();

  const yarnrcYmlPath = path.resolve(config.dirPath, '.yarnrc.yml');
  const doc = yaml.load(await fsp.readFile(yarnrcYmlPath, 'utf8')) as any;
  doc.defaultSemverRangePrefix = '';
  if (config.requiringNodeModules) {
    doc.nmMode = 'hardlinks-global';
  }
  await fsp.writeFile(yarnrcYmlPath, yaml.dump(doc));
  if (
    (config.containingTypeScript || config.containingTypeScriptInPackages) &&
    !(doc.plugins || []).some((p: any) => p.spec === '@yarnpkg/plugin-typescript')
  ) {
    spawnSync('yarn', ['plugin', 'import', 'typescript'], config.dirPath);
    if (!config.requiringNodeModules) {
      spawnSync('yarn', ['dlx', '@yarnpkg/sdks', 'vscode'], config.dirPath);
    }
  }
  if (config.containingSubPackageJsons) {
    spawnSync('yarn', ['plugin', 'import', '@yarnpkg/plugin-workspace-tools'], config.dirPath);
  }
  spawnSync('yarn', ['dlx', 'yarn-plugin-auto-install'], config.dirPath);
}
