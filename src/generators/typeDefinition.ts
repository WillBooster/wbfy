import fs from 'node:fs/promises';
import path from 'node:path';

import { ignoreEnoentAsync } from '@willbooster/shared-lib';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';

export async function fixTypeDefinitions(config: PackageConfig): Promise<void> {
  return logger.function('fixTypeDefinitions', async () => {
    const libTypeDirPath = path.resolve(config.dirPath, '@types');
    const srcTypeDirPath =
      config.root && config.containingSubPackageJsons ? undefined : path.resolve(config.dirPath, 'src', 'types');

    const dirents = await ignoreEnoentAsync(() => fs.readdir(libTypeDirPath, { withFileTypes: true }));
    if (!dirents) return;

    for (const dirent of dirents) {
      const dirName = dirent.name.slice(0, -5);
      const hasLibrary = config.packageJson?.dependencies?.[dirName] || config.packageJson?.devDependencies?.[dirName];

      if (dirent.isFile() && dirent.name.endsWith('.d.ts')) {
        if (hasLibrary) {
          await fs.mkdir(path.join(libTypeDirPath, dirName));
          await promisePool.run(() =>
            fs.rename(path.join(libTypeDirPath, dirent.name), path.join(libTypeDirPath, dirName, 'index.d.ts'))
          );
        } else if (srcTypeDirPath) {
          await fs.mkdir(srcTypeDirPath, { recursive: true });
          await promisePool.run(() =>
            fs.rename(path.join(libTypeDirPath, dirent.name), path.join(srcTypeDirPath, dirent.name))
          );
        }
      } else if (dirent.isDirectory() && srcTypeDirPath && !hasLibrary) {
        await fs.mkdir(srcTypeDirPath, { recursive: true });
        await promisePool.run(() =>
          ignoreEnoentAsync(() =>
            fs.rename(path.join(libTypeDirPath, dirent.name), path.join(srcTypeDirPath, `${dirName}.d.ts`))
          )
        );
      }
    }
  });
}
