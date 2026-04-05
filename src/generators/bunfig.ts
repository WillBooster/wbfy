import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

const minimumReleaseAgeExcludes = [
  '@exercode/problem-utils',
  '@next/env',
  '@next/eslint-plugin-next',
  '@next/font',
  '@next/rspack-binding-linux-arm64-gnu',
  '@next/rspack-binding-linux-arm64-musl',
  '@next/rspack-binding-linux-x64-gnu',
  '@next/rspack-binding-linux-x64-musl',
  '@next/swc-android-arm-eabi',
  '@next/swc-android-arm64',
  '@next/swc-darwin-arm64',
  '@next/swc-darwin-x64',
  '@next/swc-freebsd-x64',
  '@next/swc-linux-arm-gnueabihf',
  '@next/swc-linux-arm64-gnu',
  '@next/swc-linux-arm64-musl',
  '@next/swc-linux-x64-gnu',
  '@next/swc-linux-x64-musl',
  '@next/swc-wasm-nodejs',
  '@next/swc-wasm-web',
  '@next/swc-win32-arm64-msvc',
  '@next/swc-win32-ia32-msvc',
  '@next/swc-win32-x64-msvc',
  '@next/third-parties',
  '@willbooster/agent-skills',
  '@willbooster/babel-configs',
  '@willbooster/biome-config',
  '@willbooster/eslint-config-blitz-next',
  '@willbooster/eslint-config-js',
  '@willbooster/eslint-config-js-react',
  '@willbooster/eslint-config-next',
  '@willbooster/eslint-config-ts',
  '@willbooster/eslint-config-ts-react',
  '@willbooster/oxfmt-config',
  '@willbooster/oxlint-config',
  '@willbooster/prettier-config',
  '@willbooster/renovate-config',
  '@willbooster/shared-lib',
  '@willbooster/shared-lib-blitz-next',
  '@willbooster/shared-lib-next',
  '@willbooster/shared-lib-node',
  '@willbooster/shared-lib-react',
  '@willbooster/wb',
  'next',
  'react',
  'react-dom',
];

const newContentWithExactTrue = `env = false
telemetry = false

[install]
exact = true
linker = "hoisted"
minimumReleaseAge = 432000 # 5 days
minimumReleaseAgeExcludes = [
${minimumReleaseAgeExcludes.map((packageName) => `    "${packageName}",`).join('\n')}
]
`;

const newContentWithExactFalse = newContentWithExactTrue.replace('exact = true', 'exact = false');

export async function generateBunfigToml(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateBunfigToml', async () => {
    const filePath = path.resolve(config.dirPath, 'bunfig.toml');
    const content =
      fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes('exact = false')
        ? newContentWithExactFalse
        : newContentWithExactTrue;
    await promisePool.run(() => fsUtil.generateFile(filePath, content));
  });
}
