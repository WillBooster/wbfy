import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';

export async function fixTestDirectories(packageDirPaths: string[]): Promise<void> {
  return logger.functionIgnoringException('fixTestDirectories', async () => {
    await Promise.all(
      packageDirPaths.map(async (packageDirPath) => {
        const oldTestDirPath = path.join(packageDirPath, '__tests__');
        const newTestDirPath = path.join(packageDirPath, 'tests');
        try {
          await fs.promises.rename(oldTestDirPath, newTestDirPath);
          const oldContent = await fs.promises.readFile(path.join(packageDirPath, 'package.json'), 'utf8');
          const newContent = oldContent.replaceAll('__tests__', 'tests');
          if (oldContent === newContent) return;

          await fs.promises.writeFile(path.join(packageDirPath, 'package.json'), newContent);
        } catch {
          // do nothing
        }
      })
    );
  });
}
