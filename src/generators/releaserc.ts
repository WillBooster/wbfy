import fs from 'fs';
import path from 'path';

import { logger } from '../logger';
import { FsUtil } from '../utils/fsUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

export async function generateReleaserc(rootConfig: PackageConfig): Promise<void> {
  return logger.function('generateReleaserc', async () => {
    const filePath = path.resolve(rootConfig.dirPath, '.releaserc.json');
    try {
      const settings = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      const plugins = settings?.plugins || [];
      for (let i = 0; i < plugins.length; i++) {
        const plugin = Array.isArray(plugins[i]) ? plugins[i][0] : plugins[i];
        if (plugin === '@semantic-release/commit-analyzer') {
          plugins[i] = [
            '@semantic-release/commit-analyzer',
            {
              preset: 'conventionalcommits',
            },
          ];
        } else if (plugin === '@semantic-release/github' && !rootConfig.publicRepo) {
          plugins[i] = ['@semantic-release/github', { successComment: false }];
        }
      }
      const newContent = JSON.stringify(settings);
      await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
    } catch (_) {
      // do nothing
    }
  });
}
