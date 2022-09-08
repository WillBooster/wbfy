import fs from 'fs';
import path from 'path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';

const semanticReleaseBadgeUrl =
  '[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)';

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

    const fileNames = fs.readdirSync(`${config.dirPath}/.github/workflows`);
    const repository = config.repository?.substring(config.repository?.indexOf(':') + 1);
    fileNames.forEach((fileName) => {
      if (fileName.startsWith('test') || fileName.startsWith('deploy')) {
        let badgeName = fileName;
        badgeName = badgeName.charAt(0).toUpperCase() + badgeName.substring(1, badgeName.indexOf('.'));
        badgeName = badgeName.replace('-', ' ');
        const badgeUrl = `[![${badgeName}](https://github.com/${repository}/actions/workflows/${fileName}/badge.svg)](https://github.com/${repository}/actions/workflows/${fileName})`;
        newContent = addBadge(config, newContent, badgeUrl, `.github/workflows/${fileName}`);
      }
    });

    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
