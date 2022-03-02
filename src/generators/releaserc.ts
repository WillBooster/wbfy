import fs from 'fs';
import path from 'path';

import { FsUtil } from '../utils/fsUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

export async function generateReleaserc(rootConfig: PackageConfig): Promise<void> {
  const filePath = path.resolve(rootConfig.dirPath, '.releaserc.json');
  try {
    const settings = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    const plugins = settings?.plugins || [];
    for (let i = 0; i < plugins.length; i++) {
      if (plugins[i] === '@semantic-release/commit-analyzer' || plugins[i][0] === '@semantic-release/commit-analyzer') {
        plugins[i] = [
          '@semantic-release/commit-analyzer',
          {
            preset: 'conventionalcommits',
          },
        ];
      }
    }
    const newContent = JSON.stringify(settings);
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  } catch (_) {
    // do nothing
  }
}
