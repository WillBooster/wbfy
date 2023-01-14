import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import { convertVersionIntoNumber } from '../utils/version.js';

const ASDF_VERSION = '0.11.0';

export async function fixDockerfiles(packageDirPaths: string[]): Promise<void> {
  return logger.function('fixDockerfiles', async () => {
    await Promise.all(
      packageDirPaths.map(async (packageDirPath) => {
        try {
          const filePath = path.join(packageDirPath, 'Dockerfile');
          const content = await fs.promises.readFile(filePath, 'utf8');
          const newContent = content.replace(/ENV\s+ASDF_VERSION\s+([\d.]+)/, (substring, version) => {
            if (convertVersionIntoNumber(version) < convertVersionIntoNumber(ASDF_VERSION)) {
              return `ENV ASDF_VERSION ${ASDF_VERSION}`;
            }
            return substring;
          });
          await fs.promises.writeFile(filePath, newContent);
        } catch {
          // do nothing
        }
      })
    );
  });
}
