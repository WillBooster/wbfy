import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

const newContent = `telemetry = false

[install]
exact = true

[run]
bun = true

`;

export async function generateBunfigToml(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateBunfigToml', async () => {
    const filePath = path.resolve(config.dirPath, 'bunfig.toml');
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
