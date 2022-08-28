import fs from 'fs';
import path from 'path';

import { getLatestVersion } from '../src/generators/yarnrc';
import { spawnSyncWithStringResult } from '../src/utils/spawnUtil';

const testFixturePackageRoot = path.resolve('..', 'test-fixtures-for-wbfy', 'packages');

test.each`
  dirPath                       | expected
  ${'yarn1'}                    | ${'1.22.19'}
  ${'yarn1-with-node-version'}  | ${'1.22.19'}
  ${'yarn1-with-tool-versions'} | ${'1.22.19'}
  ${'berry'}                    | ${'3.2.1'}
  ${'berry-with-node-version'}  | ${'3.2.1'}
  ${'berry-with-tool-versions'} | ${'3.2.1'}
`('spawnSync on $dirPath repo', ({ dirPath, expected }: { dirPath: string; expected: string }) => {
  const packageDirPath = path.resolve(testFixturePackageRoot, dirPath);
  expect(fs.existsSync(packageDirPath)).toBe(true);
  spawnSyncWithStringResult('asdf', ['install'], packageDirPath);
  const version = spawnSyncWithStringResult('yarn', ['--version'], packageDirPath);
  expect(version).toBe(expected);
});

test('get latest version of yarn berry', () => {
  const version = getLatestVersion('@yarnpkg/cli', process.cwd());
  expect(version).toMatch(/^[4-9]./);
});
