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

[run]
bun = true
`;

const newContentWithExactFalse = `env = false
telemetry = false

[install]
exact = false

[run]
bun = true
`;

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
