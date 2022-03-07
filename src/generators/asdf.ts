import fs from 'fs';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  if (!config.versionsText) return;

  const lines: string[] = [];
  for (const versionText of config.versionsText.split('\n')) {
    const line = versionText.trim();
    if (!line.startsWith('nodejs ')) {
      lines.push(line);
      continue;
    }

    const [, version] = line.split(/\s+/);
    await promisePool.run(() => fs.promises.writeFile(path.resolve(config.dirPath, '.node-version'), version));
  }
  if (config.containingPoetryLock) {
    updateLine('poetry 1.1.13', 0, lines);
    updateLine('python 3.9.10', 0, lines);
  }
  if (config.depending.firebase) {
    updateLine('java adoptopenjdk-11.0.14+9', 0, lines);
  }
  if (config.containingPackageJson) {
    updateLine('yarn 1.22.17', lines.length, lines);
  }

  const toolVersionsPath = path.resolve(config.dirPath, '.tool-versions');
  if (lines.length) {
    await promisePool.run(() => fs.promises.writeFile(toolVersionsPath, lines.join('\n')));
  } else {
    await promisePool.run(() => fs.promises.rm(toolVersionsPath, { force: true }));
  }
}

function updateLine(line: string, insertionIndex: number, lines: string[]): void {
  const prefix = line.split(' ') + ' ';
  const index = lines.findIndex((l) => l.startsWith(prefix));
  if (index >= 0) {
    lines[index] = line;
  } else {
    lines.splice(insertionIndex, 0, line);
  }
}
