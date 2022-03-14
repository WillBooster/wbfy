import path from 'path';

import { extensions } from '../utils/extensions';
import { FsUtil } from '../utils/fsUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

const newContent = `* text=auto

*.vcproj text eol=crlf

${extensions.codeWith2IndentSize
  .concat(extensions.codeWith4IndentSize)
  .concat(extensions.markdownLike)
  .map((ext) => `*.${ext} text eol=lf`)
  .join('\n')}
`;

export async function generateGitattributes(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.gitattributes');
  await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
}
