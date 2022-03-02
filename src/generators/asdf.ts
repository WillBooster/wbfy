import fs from 'fs';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  if (!config.versionsText) return;

  const lines: string[] = [];
  for (const versionText of config.versionsText.split('\n')) {
    const line = versionText.trim();
    if (!line.startsWith('nodejs')) {
      lines.push(line);
      continue;
    }

    const [, version] = line.split(/\s+/);
    await promisePool.run(() => fs.promises.writeFile(path.resolve(config.dirPath, '.node-version'), version));
  }

  const toolVersionsPath = path.resolve(config.dirPath, '.tool-versions');
  if (lines.length) {
    await promisePool.run(() => fs.promises.writeFile(toolVersionsPath, lines.join('\n')));
  } else {
    await promisePool.run(() => fs.promises.rm(toolVersionsPath, { force: true }));
  }
}
