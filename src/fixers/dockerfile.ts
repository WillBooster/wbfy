import fs from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';

export async function fixDockerfile(config: PackageConfig): Promise<void> {
  return logger.function('fixDockerfile', async () => {
    if (!config.containingDockerfile) return;

    const filePath = path.join(config.dirPath, 'Dockerfile');
    const oldContent = await fs.readFile(filePath, 'utf8');

    let newContent = oldContent.replaceAll('then(process.stdout.write)', 'then(t => process.stdout.write(t))');
    if (oldContent.includes('FROM node')) {
      newContent = newContent.replace(
        /curl https:\/\/raw.githubusercontent.com\/WillBooster(\S+)/g,
        'node -e \'fetch("https://raw.githubusercontent.com/WillBooster$1").then(r => r.text()).then(t => process.stdout.write(t))\''
      );
    }

    if (oldContent === newContent) return;
    await fs.writeFile(filePath, oldContent);
  });
}
