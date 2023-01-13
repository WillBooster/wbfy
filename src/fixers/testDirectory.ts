import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';

export async function fixTestDirectories(packageDirPaths: string[]): Promise<void> {
  return logger.function('fixTestDirectories', async () => {
    await Promise.all(
      packageDirPaths.map(async (packageDirPath) => {
        const oldTestDirPath = path.join(packageDirPath, '__tests__');
        const newTestDirPath = path.join(packageDirPath, 'tests');
        try {
          await fs.promises.rename(oldTestDirPath, newTestDirPath);
          const packageJsonText = await fs.promises.readFile(path.join(packageDirPath, 'package.json'), 'utf8');
          const newPackageJsonText = packageJsonText.replace(/__tests__/g, 'tests');
          await fs.promises.writeFile(path.join(packageDirPath, 'package.json'), newPackageJsonText);
        } catch {
          // do nothing
        }
      })
    );
  });
}
