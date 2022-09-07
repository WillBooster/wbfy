import fs from 'fs';
import path from 'path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';

const semanticReleaseBadgeUrl =
  '[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)';
const testBadgeUrl =
  '[![Test](https://github.com/WillBooster/wbfy/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/wbfy/actions/workflows/test.yml)';

function addBadge(config: PackageConfig, newContent: string, badgeUrl: string, fileName: string): string {
  if (fs.existsSync(path.resolve(config.dirPath, fileName))) {
    if (newContent.includes(badgeUrl)) {
      // 既にbadgeがある場合は削除
      const badgePos = newContent.indexOf(badgeUrl);
      newContent = newContent.substring(0, badgePos) + newContent.substring(badgePos + badgeUrl.length);
    }
    let inserted = false;
    for (let i = 0; i < newContent.length; i++) {
      if (newContent[i] === '\n') {
        inserted = true;
        newContent = `${newContent.slice(0, i + 1)}${badgeUrl}\n${newContent.slice(i + 1)}`;
        break;
      }
    }
    if (!inserted) newContent = `${newContent}\n${badgeUrl}\n`;
  }
  return newContent;
}

export async function generateReadme(config: PackageConfig): Promise<void> {
  return logger.function('generateReadme', async () => {
    const filePath = path.resolve(config.dirPath, 'README.md');
    let newContent = await fs.promises.readFile(filePath, 'utf8');

    newContent = addBadge(config, newContent, semanticReleaseBadgeUrl, '.releaserc.json');
    newContent = addBadge(config, newContent, testBadgeUrl, '.github/workflows/test.yml');

    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
