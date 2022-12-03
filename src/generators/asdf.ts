import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { promisePool } from '../utils/promisePool';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  return logger.function('generateVersionConfigs', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  if (!config.versionsText) return;

  const lines: string[] = [];
  for (const versionText of config.versionsText.trim().split('\n')) {
    const line = versionText.trim();
    if (line && line.split(/\s+/)[0] !== 'nodejs') {
      lines.push(line);
      continue;
    }

    const [, version] = line.split(/\s+/);
    await promisePool.run(() => fs.promises.writeFile(path.resolve(config.dirPath, '.node-version'), version));
  }
  if (config.containingPoetryLock) {
    updateLine('poetry 1.2.2', 0, lines);
    if (!fs.existsSync(path.resolve(config.dirPath, '.python-version'))) {
      updateLine('python 3.9.15', 0, lines);
    }
  }
  if (config.depending.firebase) {
    updateLine('java adoptopenjdk-17.0.5+8', 0, lines);
  }
  if (config.containingPackageJson) {
    const version = spawnSyncWithStringResult('npm', ['show', 'yarn', 'version'], config.dirPath);
    updateLine(`yarn ${version}`, lines.length, lines);
  }

  const toolVersionsPath = path.resolve(config.dirPath, '.tool-versions');
  await (lines.length > 0
    ? promisePool.run(() => fs.promises.writeFile(toolVersionsPath, lines.join('\n') + '\n'))
    : promisePool.run(() => fs.promises.rm(toolVersionsPath, { force: true })));
  await promisePool.promiseAll();
  spawnSync('asdf', ['plugin', 'update', '--all'], config.dirPath);
  spawnSync('asdf', ['install'], config.dirPath);
}

function updateLine(line: string, insertionIndex: number, lines: string[]): void {
  const [prefix] = line.split(' ');
  const index = lines.findIndex((l) => l.split(/\s+/)[0] === prefix);
  if (index >= 0) {
    lines[index] = line;
  } else {
    lines.splice(insertionIndex, 0, line);
  }
}
