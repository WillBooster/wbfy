import path from 'path';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { Extensions } from '../utils/extensions';

const content = `* text=auto

*.vcproj text eol=crlf

${Extensions.codeWith2IndentSize
  .concat(Extensions.codeWith4IndentSize)
  .concat(Extensions.markdownLike)
  .map(ext => `*.${ext} text eol=lf`)
  .join('\n')}
`;

export async function generateGitattributes(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.gitattributes');
  await FsUtil.generateFile(filePath, content);
}
