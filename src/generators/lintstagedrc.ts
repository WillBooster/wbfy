import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { EslintUtil } from '../utils/eslintUtil';
import { extensions } from '../utils/extensions';
import { FsUtil } from '../utils/fsUtil';
import { promisePool } from '../utils/promisePool';
import { getSrcDirs } from '../utils/srcDirectories';

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  return logger.function('generateLintstagedrc', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const lines: string[] = [];
  if (config.containingJavaScript || config.containingTypeScript) {
    const eslint = `
  '${getEslintKey(config)}': [${JSON.stringify(
      `node node_modules/.bin/eslint --fix${EslintUtil.getLintFixSuffix(config)}`
    )}, 'node node_modules/.bin/prettier --cache --write'],`;
    lines.push(eslint);
  }
  const packagesFilter = config.root ? " && !file.includes('/packages/')" : '';
  lines.push(`
  './**/*.{${extensions.prettier.join(',')}}': files => {
    ${config.containingJavaScript || config.containingTypeScript ? getEslintFilterForPrettier(config) : ''}
    const filteredFiles = files.filter(file => !file.includes('/test-fixtures/')${packagesFilter});
    if (filteredFiles.length === 0) return [];
    const commands = [\`node node_modules/.bin/prettier --cache --write \${filteredFiles.join(' ')}\`];
    if (filteredFiles.some(file => file.endsWith('package.json'))) {
      commands.push('node node_modules/.bin/sort-package-json');
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
  await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
}

function getEslintKey(config: PackageConfig): string {
  const dirs = getSrcDirs(config);
  return `./{${dirs.join(',')}}/**/*.{${extensions.eslint.join(',')}}`;
}

function getEslintFilterForPrettier(config: PackageConfig): string {
  return `files = micromatch.not(files, '${getEslintKey(config)}');`;
}
