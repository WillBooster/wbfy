import path from 'path';
import fse from 'fs-extra';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { Extensions } from '../utils/extensions';

const eslintKey = `./{packages/*/,}{src,__tests__}/**/*.{${Extensions.eslint.join(',')}}`;
const eslint = `
  "${eslintKey}": ["eslint --fix", "git add"],`;
const eslintFilterForPrettier = `files = micromatch.not(files, '${eslintKey}');`;

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  const lines: string[] = [];
  if (config.containingJavaScript || config.containingTypeScript) {
    lines.push(eslint);
  }
  lines.push(`
  "./**/*.{${Extensions.prettier.join(',')}}": files => {
    ${config.containingJavaScript || config.containingTypeScript ? eslintFilterForPrettier : ''}
    const fileList = files.filter(file => !file.includes('/test-fixtures/')).join(' ');
    return fileList ? [\`prettier --write \${fileList}\`, \`git add \${fileList}\`] : [];
  },`);

  const content = `const micromatch = require('micromatch');
module.exports = {${lines.join('')}
};
`;

  const filePath = path.resolve(config.dirPath, '.lintstagedrc.js');
  await Promise.all([
    fse.remove(path.resolve(config.dirPath, '.lintstagedrc.json')),
    FsUtil.generateFile(filePath, content),
  ]);
}
