import fs from 'node:fs';
import path from 'node:path';

import { globby } from 'globby';

import { logger } from '../logger.js';
import { promisePool } from '../utils/promisePool.js';

export async function fixAbbreviations(dirPath: string): Promise<void> {
  return logger.function('fixAbbreviations', async () => {
    const mdFiles = await globby('**/*.md', { dot: true, cwd: dirPath });
    for (const mdFile of mdFiles) {
      const filePath = path.join(dirPath, mdFile);
      await promisePool.run(async () => {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const newContent = content.replaceAll('c.f.', 'cf.').replaceAll('eg.', 'e.g.').replaceAll('ie.', 'i.e.');
        await fs.promises.writeFile(filePath, newContent);
      });
    }

    const tsFiles = await globby('**/*.(ts|tsx)', { dot: true, cwd: dirPath });
    for (const tsFile of tsFiles) {
      const filePath = path.join(dirPath, tsFile);
      const content = await fs.promises.readFile(filePath, 'utf8');
      const newContent = content
        .replaceAll(/\/\/(.*)c\.f\./g, '//$1cf.')
        .replaceAll(/\/\/(.*)eg\./g, '//$1e.g.')
        .replaceAll(/\/\/(.*)ie\./g, '//$1i.e.');
      await fs.promises.writeFile(filePath, newContent);
    }

    await promisePool.promiseAll();
  });
}
