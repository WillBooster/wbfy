import fs from 'fs';
import path from 'path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';

export async function generateReadme(config: PackageConfig): Promise<void> {
  return logger.function('generateReadme', async () => {
    const filePath = path.resolve(config.dirPath, 'README.md');
    let newContent = await fs.promises.readFile(filePath, 'utf8');

    const useSemanticRelease = fs.existsSync(path.resolve(config.dirPath, '.releaserc.json'));
    if (useSemanticRelease) {
      // TODO: READMEをパースして、
      // [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
      // が存在するかどうかを確認する。
      // 存在しなければ、 newContent の良い感じの場所に追記する。
      // 良い感じの場所に追記することが少し難しそう。
      const badgeUrl =
        '[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)';
      if (newContent.indexOf(badgeUrl) === -1) {
        let inserted = false;
        for (let i = 0; i + 1 < newContent.length; i++) {
          if (newContent.substring(i, i + 2) === '##') {
            inserted = true;
            newContent = newContent.slice(0, i) + badgeUrl + '\n' + newContent.slice(i);
            break;
          }
        }
        if (!inserted) newContent = newContent + '\n' + badgeUrl + '\n';
      }
      newContent = newContent + '';
    }

    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
