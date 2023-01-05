import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { extensions } from '../utils/extensions';
import { fsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';

const newContent = `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

${generateExtensions(extensions.codeWith2IndentSize)}
indent_size = 2
indent_style = space

${generateExtensions(extensions.codeWith4IndentSize)}
indent_size = 4
indent_style = space

${generateExtensions(extensions.codeWith8IndentSize)}
indent_size = 8
indent_style = space

${generateExtensions(extensions.markdownLike)}
max_line_length = off
trim_trailing_whitespace = false

[{Makefile,*.mk}]
indent_style = tab
`;

export async function generateEditorconfig(config: PackageConfig): Promise<void> {
  return logger.function('generateEditorconfig', async () => {
    const filePath = path.resolve(config.dirPath, '.editorconfig');
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}

function generateExtensions(extensions: string[]): string {
  return extensions.length > 1 ? `[*.{${extensions.join(',')}}]` : `[*.${extensions[0]}]`;
}
