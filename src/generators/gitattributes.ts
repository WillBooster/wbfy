import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { extensions } from '../utils/extensions.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

const newContent = `* text=auto

*.vcproj text eol=crlf

${[...extensions.codeWith2IndentSize, ...extensions.codeWith4IndentSize, ...extensions.markdownLike]
  .map((ext) => `*.${ext} text eol=lf`)
  .join('\n')}

dist/** linguist-generated=true
`;

export async function generateGitattributes(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateGitattributes', async () => {
    const filePath = path.resolve(config.dirPath, '.gitattributes');
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
