import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';

export async function generateReleaserc(rootConfig: PackageConfig): Promise<void> {
  const releasercJsonPath = path.resolve(rootConfig.dirPath, '.releaserc.json');
  try {
    const settings = JSON.parse(await fsp.readFile(releasercJsonPath, 'utf8'));
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
    return fsp.writeFile(releasercJsonPath, JSON.stringify(settings));
  } catch (_) {
    // do nothing
  }
}
