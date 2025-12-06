import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { getPackageConfig } from '../src/packageConfig.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => fs.promises.rm(dirPath, { force: true, recursive: true })));
  tempDirs.length = 0;
});

describe('willbooster-configs package detection', () => {
  test('skips ESLint config packages inside willbooster-configs', async () => {
    const dirPath = createTempRepo('wbfy-willbooster-configs-');
    await writePackageJson(dirPath, '@willbooster/eslint-config-ts');

    const config = await getPackageConfig(dirPath);

    expect(config?.shouldSkipApplying).toBe(true);
  });

  test('does not skip non-ESLint packages inside willbooster-configs', async () => {
    const dirPath = createTempRepo('wbfy-willbooster-configs-');
    await writePackageJson(dirPath, '@willbooster/prettier-config');

    const config = await getPackageConfig(dirPath);

    expect(config?.shouldSkipApplying).toBe(false);
  });

  test('does not skip ESLint packages outside willbooster-configs', async () => {
    const dirPath = createTempRepo('wbfy-other-');
    await writePackageJson(dirPath, '@willbooster/eslint-config-ts');

    const config = await getPackageConfig(dirPath);

    expect(config?.shouldSkipApplying).toBe(false);
  });
});

function createTempRepo(prefix: string): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dirPath);
  execSync('git init -q', { cwd: dirPath });
  return dirPath;
}

async function writePackageJson(dirPath: string, name: string): Promise<void> {
  const packageJson = {
    name,
    version: '0.0.0',
    repository: 'github:WillBooster/willbooster-configs',
  };
  await fs.promises.writeFile(path.join(dirPath, 'package.json'), JSON.stringify(packageJson));
}
