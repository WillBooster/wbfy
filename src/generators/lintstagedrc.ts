import path from 'path';
import fse from 'fs-extra';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { Extensions } from '../utils/extensions';
import { EslintUtil } from '../utils/eslintUtil';

const eslintKey = `./{packages/*/,}{src,__tests__}/**/*.{${Extensions.eslint.join(',')}}`;
const eslintFilterForPrettier = `files = micromatch.not(files, '${eslintKey}');`;

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  const lines: string[] = [];
  if (config.containingJavaScript || config.containingTypeScript) {
    const eslint = `
  '${eslintKey}': ['eslint --fix${EslintUtil.getLintFixSuffix(config)}'],`;
    lines.push(eslint);
  }
  lines.push(`
  './**/*.{${Extensions.prettier.join(',')}}': files => {
    ${config.containingJavaScript || config.containingTypeScript ? eslintFilterForPrettier : ''}
    const fileList = files.filter(file => !file.includes('/test-fixtures/'))
      .map(file => path.relative('', file))
      .join(' ');
    return fileList ? [\`prettier --write \${fileList}\`] : [];
  },`);

  const content = `const micromatch = require('micromatch');
const path = require('path');

module.exports = {${lines.join('')}
};
`;

  const filePath = path.resolve(config.dirPath, '.lintstagedrc.js');
  await Promise.all([
    fse.remove(path.resolve(config.dirPath, '.lintstagedrc.json')),
    FsUtil.generateFile(filePath, content),
  ]);
}
