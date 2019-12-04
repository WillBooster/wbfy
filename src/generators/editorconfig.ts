import path from 'path';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { Extensions } from '../utils/extensions';

const content = `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{${Extensions.codeWith2IndentSize.join(',')}}]
indent_style = space
indent_size = 2

[*.{${Extensions.markdownLike.join(',')}}]
trim_trailing_whitespace = false
`;

export async function generateEditorconfig(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.editorconfig');
  await FsUtil.generateFile(filePath, content);
}
