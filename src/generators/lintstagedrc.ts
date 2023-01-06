import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';
import { EslintUtil } from '../utils/eslintUtil.js';
import { extensions } from '../utils/extensions.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';
import { getSrcDirs } from '../utils/srcDirectories.js';

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  return logger.function('generateLintstagedrc', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const packagePrefix = config.root ? 'node node_modules/.bin/' : 'node ../../node_modules/.bin/';
  const lines: string[] = [];
  if (config.containingJavaScript || config.containingTypeScript) {
    const eslint = `
  '${getEslintKey(config)}': [${JSON.stringify(
      `${packagePrefix}eslint --fix${EslintUtil.getLintFixSuffix(config)}`
    )}, '${packagePrefix}prettier --cache --write'],`;
    lines.push(eslint);
  }
  const packagesFilter = config.root ? " && !file.includes('/packages/')" : '';
  lines.push(`
  './**/*.{${extensions.prettier.join(',')}}': files => {
    ${config.containingJavaScript || config.containingTypeScript ? getEslintFilterForPrettier(config) : ''}
    const filteredFiles = files.filter(file => !file.includes('/test-fixtures/')${packagesFilter});
    if (filteredFiles.length === 0) return [];
    const commands = [\`${packagePrefix}prettier --cache --write \${filteredFiles.join(' ')}\`];
    if (filteredFiles.some(file => file.endsWith('package.json'))) {
      commands.push('${packagePrefix}sort-package-json');
    }
    return commands;
  },`);
  if (config.containingPubspecYaml) {
    lines.push(`
  './{lib,test,test_driver}/**/*.dart': files => {
    const filteredFiles = files.filter(file => !file.includes('generated'))
      .filter(file => !file.endsWith('.freezed.dart') && !file.endsWith('.g.dart'));
    if (filteredFiles.length === 0) return [];
    return [\`flutter format \${filteredFiles.join(' ')}\`];
  },`);
  }
  if (config.containingPoetryLock) {
    lines.push(`
  './**/*.py': [
    'poetry run isort --profile black --filter-files',
    'poetry run black',
    'poetry run flake8'
  ],`);
  }

  const newContent = `${
    config.containingJavaScript || config.containingTypeScript ? "const micromatch = require('micromatch');" : ''
  }

module.exports = {${lines.join('')}
};
`;

  const filePath = path.resolve(config.dirPath, '.lintstagedrc.cjs');
  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.lintstagedrc.js'), { force: true }));
  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.lintstagedrc.json'), { force: true }));
  await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
}

function getEslintKey(config: PackageConfig): string {
  const dirs = getSrcDirs(config);
  return `./{${dirs.join(',')}}/**/*.{${extensions.eslint.join(',')}}`;
}

function getEslintFilterForPrettier(config: PackageConfig): string {
  return `files = micromatch.not(files, '${getEslintKey(config)}');`;
}
