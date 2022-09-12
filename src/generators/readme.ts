import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';

export async function generateReadme(config: PackageConfig): Promise<void> {
  return logger.function('generateReadme', async () => {
    const filePath = path.resolve(config.dirPath, 'README.md');
    let newContent = await fs.promises.readFile(filePath, 'utf8');

    newContent = insertBadge(config, newContent, semanticReleaseBadge, '.releaserc.json');

    const repository = config.repository?.slice(
      Math.max(0, Math.max(0, Math.max(0, Math.max(0, Math.max(0, config.repository?.indexOf(':') + 1)))))
    );
    const fileNames = fs.readdirSync(`${config.dirPath}/.github/workflows`);
    for (const fileName of fileNames) {
      if (!fileName.startsWith('test') && !fileName.startsWith('deploy')) continue;

      let badgeName = fileName;
      badgeName = badgeName.charAt(0).toUpperCase() + badgeName.slice(1, badgeName.indexOf('.'));
      badgeName = badgeName.replace('-', ' ');
      const badge = `[![${badgeName}](https://github.com/${repository}/actions/workflows/${fileName}/badge.svg)](https://github.com/${repository}/actions/workflows/${fileName})`;
      newContent = insertBadge(config, newContent, badge, `.github/workflows/${fileName}`);
    }

    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}

const semanticReleaseBadge =
  '[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)';

function insertBadge(config: PackageConfig, newContent: string, badge: string, fileName: string): string {
  if (!fs.existsSync(path.resolve(config.dirPath, fileName))) {
    return newContent;
  }

  // 既にbadgeがある場合は削除
  const badgePos = newContent.indexOf(badge);
  if (badgePos >= 0) {
    newContent =
      newContent.slice(0, Math.max(0, Math.max(0, Math.max(0, Math.max(0, Math.max(0, badgePos)))))) +
      newContent.slice(Math.max(0, Math.max(0, Math.max(0, Math.max(0, Math.max(0, badgePos + badge.length))))));
  }
  let inserted = false;
  for (let i = 0; i < newContent.length; i++) {
    if (newContent[i] === '\n') {
      inserted = true;
      newContent = `${newContent.slice(
        0,
        Math.max(0, Math.max(0, Math.max(0, Math.max(0, i + 1))))
      )}${badge}\n${newContent.slice(Math.max(0, Math.max(0, Math.max(0, Math.max(0, i + 1)))))}`;
      break;
    }
  }
  if (!inserted) newContent = `${newContent}\n${badge}\n`;
  return newContent;
}
