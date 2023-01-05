import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { extensions } from '../utils/extensions';
import { fsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';

const newContent = `* text=auto

*.vcproj text eol=crlf

${[...extensions.codeWith2IndentSize, ...extensions.codeWith4IndentSize, ...extensions.markdownLike]
  .map((ext) => `*.${ext} text eol=lf`)
  .join('\n')}
`;

export async function generateGitattributes(config: PackageConfig): Promise<void> {
  return logger.function('generateGitattributes', async () => {
    const filePath = path.resolve(config.dirPath, '.gitattributes');
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
