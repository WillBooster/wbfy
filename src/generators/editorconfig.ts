import path from 'path';
import fs from 'fs-extra';
import { PackageConfig } from '../types/packageConfig';

const content = `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{cpp,js,json,jsx,pu,puml,rb,ts,tsx,vue,yaml,yml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
`;

export async function generateEditorconfig(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.editorconfig');
  await fs.outputFile(filePath, content);
  console.log(`Generated ${filePath}`);
}
