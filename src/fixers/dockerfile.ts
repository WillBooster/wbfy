import fs from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';

export async function fixDockerfile(config: PackageConfig): Promise<void> {
  return logger.function('fixDockerfile', async () => {
    if (!config.containingDockerfile) return;

    const filePath = path.join(config.dirPath, 'Dockerfile');
    const oldContent = await fs.readFile(filePath, 'utf8');

    // TODO: remove the following migration code in future
    let newContent = oldContent.replaceAll('then(process.stdout.write)', 'then(t => process.stdout.write(t))');
    if (oldContent.includes('FROM node')) {
      newContent = newContent
        .replaceAll(
          /curl https:\/\/raw.githubusercontent.com\/WillBooster(\S+)/g,
          'node -e \'fetch("https://raw.githubusercontent.com/WillBooster$1").then(r => r.text()).then(t => process.stdout.write(t))\''
        )
        .replaceAll('wb db', 'wb prisma');
      if (newContent.includes('node node_modules/.bin/wb') && !newContent.includes('procps')) {
        // `wb` depends on `tree-kill` which requires `ps` command contained in `procps` package
        newContent = newContent.replaceAll(/apt-get -qq install -y --no-install-recommends (.+)\\/g, (substr, args) => {
          const packages = args.trim().split(/\s+/);
          packages.push('procps');
          return `apt-get -qq install -y --no-install-recommends ${packages.sort().join(' ')} \\`;
        });
      }
    }

    if (oldContent === newContent) return;
    await fs.writeFile(filePath, newContent);
  });
}
