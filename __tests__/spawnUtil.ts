import child_process from 'child_process';
import path from 'path';

import { getSpawnSyncArgs, spawnSync } from '../src/utils/spawnUtil';

const testFixturePackageRoot = path.resolve('..', 'test-fixtures-for-wbfy', 'packages');

test.each`
  dirPath                 | expected
  ${'yarn1'}              | ${'1.22.10'}
  ${'yarn1-with-version'} | ${'1.22.10'}
  ${'yarn2'}              | ${'2.4.2'}
  ${'yarn2-with-version'} | ${'2.4.2'}
  ${'yarn3'}              | ${'3.0.1'}
  ${'yarn3-with-version'} | ${'3.0.1'}
`('spawnSync on $dirPath repo', ({ dirPath, expected }: { dirPath: string; expected: string }) => {
  const [commandAndArgs, options] = getSpawnSyncArgs(
    'yarn',
    ['--version'],
    path.resolve(testFixturePackageRoot, dirPath)
  );
  options.stdio = 'pipe';
  const p = child_process.spawnSync(commandAndArgs, options);
  expect(p.stdout.toString().trim()).toBe(expected);
});

test('spawnSync on willbooster-configs', () => {
  spawnSync('yarn', ['install'], path.resolve('..', 'willbooster-configs'));
});
