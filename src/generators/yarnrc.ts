import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil';

export async function generateYarnrcYml(config: PackageConfig): Promise<void> {
  const currentVersion = spawnSyncWithStringResult('yarn', ['--version'], config.dirPath);
  const latestVersion = spawnSyncWithStringResult('npm', ['show', '@yarnpkg/cli', 'version'], config.dirPath);
  if (currentVersion !== latestVersion) {
    spawnSync('yarn', ['set', 'version', latestVersion], config.dirPath, 1);
  }

  const releasesPath = path.join(config.dirPath, '.yarn', 'releases');
  await fs.promises.mkdir(releasesPath, { recursive: true });
  for (const file of await fs.promises.readdir(releasesPath)) {
    if (file.startsWith('yarn-') && !file.startsWith(`yarn-${latestVersion}.`)) {
      await promisePool.run(() => fs.promises.rm(path.join(releasesPath, file)));
      console.log('Removed', path.join(releasesPath, file));
    }
  }

  const yarnrcPath = path.resolve(config.dirPath, '.yarnrc');
  await promisePool.run(() => fs.promises.rm(yarnrcPath, { force: true }));

  const yarnrcYmlPath = path.resolve(config.dirPath, '.yarnrc.yml');
  const settings = yaml.load(await fs.promises.readFile(yarnrcYmlPath, 'utf8')) as any;
  settings.defaultSemverRangePrefix = '';
  if (config.requiringNodeModules) {
    settings.nodeLinker = 'node-modules';
    settings.nmMode = 'hardlinks-global';
  }
  await fs.promises.writeFile(yarnrcYmlPath, yaml.dump(settings, { lineWidth: -1 }));

  const plugins = (settings.plugins || []).map((p: any) => p.spec as string);
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
