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

  const plugins = (doc.plugins || []).map((p: any) => p.spec as string);
  const requireTypeScript = config.containingTypeScript || config.containingTypeScriptInPackages;
  importOrRemovePlugin(config, plugins, requireTypeScript, '@yarnpkg/plugin-typescript');
  if (requireTypeScript && !config.requiringNodeModules) {
    spawnSync('yarn', ['dlx', '@yarnpkg/sdks', 'vscode'], config.dirPath);
  }
  importOrRemovePlugin(config, plugins, config.containingSubPackageJsons, '@yarnpkg/plugin-workspace-tools');
  spawnSync('yarn', ['dlx', 'yarn-plugin-auto-install'], config.dirPath);
}

function importOrRemovePlugin(config: PackageConfig, plugins: string[], requirePlugin: boolean, plugin: string): void {
  if (requirePlugin !== plugins.includes(plugin)) {
    spawnSync('yarn', ['plugin', requirePlugin ? 'import' : 'remove', plugin], config.dirPath);
  }
}
