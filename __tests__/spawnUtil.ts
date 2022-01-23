import child_process from 'child_process';
import path from 'path';

import { getSpawnSyncArgs, spawnSync } from '../src/utils/spawnUtil';

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
