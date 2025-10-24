import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { octokit } from '../utils/githubUtil.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync, spawnSyncWithStringResult } from '../utils/spawnUtil.js';
import { convertVersionIntoNumber } from '../utils/version.js';
import { JAVA_VERSION, PYTHON_VERSION } from '../utils/versionConstants.js';

export async function generateToolVersions(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateToolVersions', async () => {
    await core(config);
  });
}

const CORE_TOOLS = new Set(['java', 'nodejs', 'bun', 'python']);
const DEPRECATED_VERSION_PREFIXES = ['java', 'node', 'python'];

async function core(config: PackageConfig): Promise<void> {
  if (!config.versionsText) return;

  const duplicatableLines = config.versionsText
    .trim()
    .split('\n')
    .map((line) => {
      const [name, version] = line.trim().split(/\s+/);
      // To move the top of the sorted list, we need to add a space.
      return `${CORE_TOOLS.has(name ?? '') ? ' ' : ''}${name ?? ''} ${version ?? ''}`;
    })
    .sort()
    // Remove added spaces.
    .map((line) => line.trim())
    // TODO: remove the following line after lefthook is installed via npm.
    .filter((line) => !line.startsWith('lefthook'));
  const lines = [...new Set(duplicatableLines)];

  if (config.doesContainPoetryLock) {
    const response = await fetch('https://pypi.org/pypi/poetry/json');
    const json = (await response.json()) as { info?: { version: string } } | undefined;
    const poetryVersion = json?.info?.version;
    if (poetryVersion) {
      updateVersion(lines, 'poetry', poetryVersion);
    }
    updateVersion(lines, 'python', PYTHON_VERSION, true);
  }
  if (config.depending.firebase) {
    updateVersion(lines, 'java', JAVA_VERSION, true);
  }
  if (config.doesContainPackageJson) {
    if (config.isBun) {
      const bunVersion = await getLatestVersionFromTagOnGitHub('oven-sh', 'bun');
      if (bunVersion) updateVersion(lines, 'bun', bunVersion);
    } else {
      const version = spawnSyncWithStringResult('npm', ['show', 'yarn', 'version'], config.dirPath);
      updateVersion(lines, 'yarn', version);
    }
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
  if (index === -1) {
    lines.splice(head ? 0 : lines.length, 0, newLine);
  } else {
    const [, version] = (lines[index] as string).split(/\s+/);
    if (convertVersionIntoNumber(newVersion) > convertVersionIntoNumber(version ?? '')) {
      lines[index] = newLine;
    }
  }
}

async function getLatestVersionFromTagOnGitHub(organization: string, repository: string): Promise<string | undefined> {
  try {
    // Fetch the latest release from the repository (no required permissions)
    const response = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
      owner: organization,
      repo: repository,
    });
    const version = response.data.tag_name;
    const index = version.lastIndexOf('v');
    const versionNumberText = index === -1 ? version : version.slice(index + 1);
    // Check the first character is a number
    return /^\d/.test(versionNumberText) ? versionNumberText : undefined;
  } catch (error) {
    console.error('Failed to fetch Bun tags due to:', error);
    return;
  }
}
