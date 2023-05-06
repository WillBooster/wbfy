import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil.js';

export async function generateYarnrcYml(config: PackageConfig): Promise<void> {
  return logger.function('generateYarnrcYml', async () => {
    const currentVersion = spawnSyncWithStringResult('yarn', ['--version'], config.dirPath);
    const latestVersion = getLatestVersion('@yarnpkg/cli', config.dirPath);
    if (getMajorNumber(currentVersion) <= getMajorNumber(latestVersion) && currentVersion !== latestVersion) {
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
    settings.nodeLinker = 'node-modules';
    settings.nmMode = 'hardlinks-global';
    // cf. https://github.com/yarnpkg/berry/pull/4698
    settings.enableGlobalCache = true;
    const originalLength = settings.plugins?.length ?? 0;
    settings.plugins = settings.plugins?.filter((p: any) => p.path !== '.yarn/plugins/undefined.cjs') ?? [];
    if (settings.plugins.length !== originalLength) {
      const pluginPath = path.resolve(config.dirPath, '.yarnrc', 'undefined.cjs');
      await promisePool.run(() => fs.promises.rm(pluginPath, { force: true }));
    }
    if (settings.plugins.length === 0) {
      delete settings.plugins;
    }
    await fs.promises.writeFile(yarnrcYmlPath, yaml.dump(settings, { lineWidth: -1 }));

    spawnSync('yarn', ['dlx', 'yarn-plugin-auto-install'], config.dirPath);
  });
}

export function getLatestVersion(packageName: string, dirPath: string): string {
  const versionsJson = spawnSyncWithStringResult('npm', ['show', packageName, 'versions', '--json'], dirPath);
  const versions = JSON.parse(versionsJson) as string[];
  return versions.at(-1);
}

function importOrRemovePlugin(config: PackageConfig, plugins: string[], requirePlugin: boolean, plugin: string): void {
  if (requirePlugin !== plugins.includes(plugin)) {
    spawnSync('yarn', ['plugin', requirePlugin ? 'import' : 'remove', plugin], config.dirPath);
  }
}

function getMajorNumber(version: string): number {
  const [major] = version.split('.');
  return Number(major);
}
