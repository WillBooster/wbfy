import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from 'vitest';

import { getLatestVersion } from '../src/generators/yarnrc.js';
import { spawnSyncWithStringResult } from '../src/utils/spawnUtil.js';

const testFixturePackageRoot = path.resolve('..', 'test-fixtures-for-wbfy', 'packages');

test.each`
  dirPath                       | expected
  ${'yarn1'}                    | ${'1.22.22'}
  ${'yarn1-with-node-version'}  | ${'1.22.22'}
  ${'yarn1-with-tool-versions'} | ${'1.22.22'}
  ${'berry'}                    | ${'4.9.1'}
  ${'berry-with-node-version'}  | ${'4.9.1'}
  ${'berry-with-tool-versions'} | ${'4.9.1'}
`(
  'spawnSync on $dirPath repo',
  { timeout: 60 * 1000 },
  ({ dirPath, expected }: { dirPath: string; expected: string }) => {
    const packageDirPath = path.resolve(testFixturePackageRoot, dirPath);
    expect(fs.existsSync(packageDirPath)).toBe(true);
    spawnSyncWithStringResult('asdf', ['install'], packageDirPath);
    const version = spawnSyncWithStringResult('yarn', ['--version'], packageDirPath);
    expect(version).toBe(expected);
  }
);

test('get latest version of yarn berry', { timeout: 120 * 1000 }, () => {
  const version = getLatestVersion('@yarnpkg/cli', process.cwd());
  expect(version).toMatch(/^[4-9]./);
});
