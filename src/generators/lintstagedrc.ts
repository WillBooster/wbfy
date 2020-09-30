import path from 'path';
import fse from 'fs-extra';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { Extensions } from '../utils/extensions';
import { EslintUtil } from '../utils/eslintUtil';

const eslintKey = `./{src,__tests__}/**/*.{${Extensions.eslint.join(',')}}`;
const eslintFilterForPrettier = `files = micromatch.not(files, '${eslintKey}');`;

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  const lines: string[] = [];
  if (config.containingJavaScript || config.containingTypeScript) {
    const eslint = `
  '${eslintKey}': [${JSON.stringify(`eslint --fix${EslintUtil.getLintFixSuffix(config)}`)}, 'prettier --write'],`;
    lines.push(eslint);
  }
  lines.push(`
  './**/*.{${Extensions.prettier.join(',')}}': files => {
    ${config.containingJavaScript || config.containingTypeScript ? eslintFilterForPrettier : ''}
    const filteredFiles = files.filter(file => !file.includes('/test-fixtures/') && !file.includes('/packages/'))
      .map(file => path.relative('', file));
    if (filteredFiles.length === 0) return [];
    const commands = [\`prettier --write \${filteredFiles.join(' ')}\`];
    if (filteredFiles.some(file => file.endsWith('package.json'))) {
      commands.push('yarn sort-package-json');
    }
    return commands;
  },`);
  if (config.containingPubspecYaml) {
    lines.push(`
  './{lib,test,test_driver}/**/*.dart': files => {
    const filteredFiles = files.filter(file => !file.includes('generated'))
      .filter(file => !file.endsWith('.freezed.dart') && !file.endsWith('.g.dart'))
      .map(file => path.relative('', file));
    if (filteredFiles.length === 0) return [];
    return [\`flutter format \${filteredFiles.join(' ')}\`];
  },`);
  }
  if (config.containingPoetryLock) {
    lines.push(`
  './**/*.py': ['poetry run black', 'poetry run flake8'],`);
  }

  const content = `const path = require('path');
${config.containingJavaScript || config.containingTypeScript ? "const micromatch = require('micromatch');" : ''}

module.exports = {${lines.join('')}
};
`;

  const filePath = path.resolve(config.dirPath, '.lintstagedrc.js');
  await Promise.all([
    fse.remove(path.resolve(config.dirPath, '.lintstagedrc.json')),
    FsUtil.generateFile(filePath, content),
  ]);
}
