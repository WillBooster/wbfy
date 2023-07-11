import fs from 'node:fs';
import path from 'node:path';

import { globby } from 'globby';

import { logger } from '../logger.js';
import { options } from '../options.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

export async function fixAbbreviations(dirPath: string): Promise<void> {
  return logger.functionIgnoringException('fixAbbreviations', async () => {
    const mdFiles = await globby('**/*.md', { dot: true, cwd: dirPath, gitignore: true });
    if (options.isVerbose) {
      console.info(`Found ${mdFiles.length} markdown files in ${dirPath}`);
    }
    for (const mdFile of mdFiles) {
      const filePath = path.join(dirPath, mdFile);
      await promisePool.run(async () => {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const newContent = content.replaceAll('c.f.', 'cf.').replaceAll('eg.', 'e.g.').replaceAll('ie.', 'i.e.');
        if (content !== newContent) {
          await fsUtil.generateFile(filePath, newContent);
        }
      });
    }

    const tsFiles = await globby(
      [
        '{app,src,tests,scripts}/**/*.{cjs,mjs,js,jsx,cts,mts,ts,tsx}',
        'packages/**/{app,src,tests,scripts}/**/*.{cjs,mjs,js,jsx,cts,mts,ts,tsx}',
      ],
      { dot: true, cwd: dirPath, gitignore: true }
    );
    if (options.isVerbose) {
      console.info(`Found ${tsFiles.length} TypeScript files in ${dirPath}`);
    }
    for (const tsFile of tsFiles) {
      const filePath = path.join(dirPath, tsFile);
      const oldContent = await fs.promises.readFile(filePath, 'utf8');
      const newContent = oldContent
        .replaceAll(/\/\/(.*)c\.f\./g, '//$1cf.')
        .replaceAll(/\/\/(.*)eg\./g, '//$1e.g.')
        .replaceAll(/\/\/(.*)ie\./g, '//$1i.e.');

      if (oldContent === newContent) continue;
      await fsUtil.generateFile(filePath, newContent);
    }

    await promisePool.promiseAll();
  });
}
