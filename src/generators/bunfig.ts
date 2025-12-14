import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

const newContentWithExactTrue = `env = false
telemetry = false

[install]
exact = true
linker = "hoisted"
minimumReleaseAge = 432000 # 5 days
minimumReleaseAgeExcludes = [
    "@exercode/problem-utils",
    "@willbooster/babel-configs",
    "@willbooster/biome-config",
    "@willbooster/eslint-config-js",
    "@willbooster/eslint-config-js-react",
    "@willbooster/eslint-config-next",
    "@willbooster/eslint-config-ts",
    "@willbooster/eslint-config-ts-react",
    "@willbooster/prettier-config",
    "@willbooster/shared-lib",
    "@willbooster/wb",
    "next",
    "@next/*",
    "react",
    "react-dom"
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
