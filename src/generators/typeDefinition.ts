import fs from 'node:fs/promises';
import path from 'node:path';

import { ignoreEnoentAsync } from '@willbooster/shared-lib';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { promisePool } from '../utils/promisePool';

export async function fixTypeDefinitions(config: PackageConfig): Promise<void> {
  return logger.function('fixTypeDefinitions', async () => {
    const typeDirPath = path.resolve(config.dirPath, '@types');

    const dirents = await ignoreEnoentAsync(() => fs.readdir(typeDirPath, { withFileTypes: true }));
    if (!dirents) return;

    for (const dirent of dirents) {
      if (dirent.isFile() && dirent.name.endsWith('.d.ts')) {
        const dirName = dirent.name.slice(0, -5);
        await fs.mkdir(path.join(typeDirPath, dirName));
        await promisePool.run(() =>
          fs.rename(path.join(typeDirPath, dirent.name), path.join(typeDirPath, dirName, 'index.d.ts'))
        );
      }
    }
  });
}
