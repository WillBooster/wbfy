import fs from 'fs';
import path from 'path';

import { spawnSyncWithStringResult } from '../src/utils/spawnUtil';

const testFixturePackageRoot = path.resolve('..', 'test-fixtures-for-wbfy', 'packages');

test.each`
  dirPath                       | expected
  ${'yarn1'}                    | ${'1.22.17'}
  ${'yarn1-with-node-version'}  | ${'1.22.17'}
  ${'yarn1-with-tool-versions'} | ${'1.22.17'}
  ${'yarn2'}                    | ${'2.4.2'}
  ${'yarn2-with-node-version'}  | ${'2.4.2'}
  ${'yarn2-with-tool-versions'} | ${'2.4.2'}
  ${'yarn3'}                    | ${'3.1.1'}
  ${'yarn3-with-node-version'}  | ${'3.1.1'}
  ${'yarn3-with-tool-versions'} | ${'3.1.1'}
`('spawnSync on $dirPath repo', ({ dirPath, expected }: { dirPath: string; expected: string }) => {
  const packageDirPath = path.resolve(testFixturePackageRoot, dirPath);
  console.log(packageDirPath);
  expect(fs.existsSync(packageDirPath)).toBe(true);
  const version = spawnSyncWithStringResult('yarn', ['--version'], packageDirPath);
  expect(version).toBe(expected);
});

test('get latest version of yarn berry', () => {
  const version = spawnSyncWithStringResult('npm', ['show', '@yarnpkg/cli', 'version'], process.cwd());
  expect(version).toMatch(/^[4-9]./);
});
