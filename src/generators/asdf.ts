import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil.js';
import { convertVersionIntoNumber } from '../utils/version.js';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  return logger.function('generateVersionConfigs', async () => {
    await core(config);
  });
}

const POETRY_VERSION = '1.3.1';
const PYTHON_VERSION = '3.9.16';
const JAVA_VERSION = 'adoptopenjdk-11.0.17+8';

async function core(config: PackageConfig): Promise<void> {
  if (!config.versionsText) return;

  const lines: string[] = [];
  for (const versionText of config.versionsText.trim().split('\n')) {
    const line = versionText.trim();
    const [name, version] = line.split(/\s+/);
    if (!name || !version) continue;
    if (name === 'nodejs') {
      await promisePool.run(() => fs.promises.writeFile(path.resolve(config.dirPath, '.node-version'), version + '\n'));
    } else if (name === 'python') {
      await promisePool.run(() =>
        fs.promises.writeFile(path.resolve(config.dirPath, '.python-version'), version + '\n')
      );
    } else {
      lines.push(line);
    }
  }

  if (config.containingPoetryLock) {
    updateVersion(lines, 'poetry', POETRY_VERSION);
    // Don't update python in .python-version automatically
    if (!fs.existsSync(path.resolve(config.dirPath, '.python-version'))) {
      updateVersion(lines, 'python', PYTHON_VERSION, true);
    }
  }
  if (config.depending.firebase) {
    updateVersion(lines, 'java', JAVA_VERSION, true);
  }
  if (config.containingPackageJson) {
    const version = spawnSyncWithStringResult('npm', ['show', 'yarn', 'version'], config.dirPath);
    updateVersion(lines, 'yarn', version);
  }

  const toolVersionsPath = path.resolve(config.dirPath, '.tool-versions');
  await (lines.length > 0
    ? promisePool.run(() => fs.promises.writeFile(toolVersionsPath, lines.join('\n') + '\n'))
    : promisePool.run(() => fs.promises.rm(toolVersionsPath, { force: true })));
  await promisePool.promiseAll();
  spawnSync('asdf', ['plugin', 'update', '--all'], config.dirPath);
  spawnSync('asdf', ['install'], config.dirPath);
}

function updateVersion(lines: string[], toolName: string, newVersion: string, head = false): void {
  const index = lines.findIndex((l) => l.split(/\s+/)[0] === toolName);
  const newLine = `${toolName} ${newVersion}`;
  if (index >= 0) {
    const [, version] = lines[index].split(/\s+/);
    if (convertVersionIntoNumber(newVersion) > convertVersionIntoNumber(version)) {
      lines[index] = newLine;
    }
  } else {
    lines.splice(head ? 0 : lines.length, 0, newLine);
  }
}
