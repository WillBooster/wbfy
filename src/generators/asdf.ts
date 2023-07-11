import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil.js';
import { convertVersionIntoNumber } from '../utils/version.js';
import { JAVA_VERSION, PYTHON_VERSION } from '../utils/versionConstants.js';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateVersionConfigs', async () => {
    await core(config);
  });
}

const CORE_TOOLS = new Set(['java', 'nodejs', 'python']);
const DEPRECATED_VERSION_PREFIXES = ['java', 'node', 'python'];

async function core(config: PackageConfig): Promise<void> {
  if (!config.versionsText) return;

  const duplicatableLines = config.versionsText
    .trim()
    .split('\n')
    .map((line) => {
      const [name, version] = line.trim().split(/\s+/);
      return `${CORE_TOOLS.has(name) ? ' ' : ''}${name} ${version}`;
    })
    .sort()
    .map((line) => line.trim());
  const lines = [...new Set(duplicatableLines)];

  if (config.containingPoetryLock) {
    const response = await fetch('https://pypi.org/pypi/poetry/json');
    const json = await response.json();
    const poetryVersion = json?.info?.version;
    if (poetryVersion) {
      updateVersion(lines, 'poetry', json?.info?.version);
    }
    updateVersion(lines, 'python', PYTHON_VERSION, true);
  }
  if (config.depending.firebase) {
    updateVersion(lines, 'java', JAVA_VERSION, true);
  }
  if (config.containingPackageJson) {
    const version = spawnSyncWithStringResult('npm', ['show', 'yarn', 'version'], config.dirPath);
    updateVersion(lines, 'yarn', version);
  }

  for (const prefix of DEPRECATED_VERSION_PREFIXES) {
    const versionPath = path.resolve(config.dirPath, `.${prefix}-version`);
    void fs.promises.rm(versionPath, { force: true });
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
