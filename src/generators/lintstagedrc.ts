import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { EslintUtil } from '../utils/eslintUtil.js';
import { extensions } from '../utils/extensions.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';
import { getSrcDirs } from '../utils/srcDirectories.js';

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateLintstagedrc', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.lintstagedrc.cjs');
  if (config.isBun) {
    await promisePool.run(() => fs.promises.rm(filePath, { force: true }));
    return;
  }

  const packagePrefix = config.isRoot ? 'node node_modules/.bin/' : 'node ../../node_modules/.bin/';
  const lines: string[] = [];
  if (config.doesContainsJavaScript || config.doesContainsTypeScript) {
    const eslint = `
  '${getEslintKey(config)}': [${JSON.stringify(
    `${packagePrefix}eslint --fix${EslintUtil.getLintFixSuffix(config)}`
  )}, '${packagePrefix}prettier --cache --write'],`;
    lines.push(eslint);
  }
  const packagesFilter = config.isRoot ? " && !file.includes('/packages/')" : '';
  lines.push(`
  './**/*.{${extensions.prettier.join(',')}}': files => {
    let filteredFiles = files.filter(file => !file.includes('/test-fixtures/')${packagesFilter});${getEslintFilterForPrettier(config)}
    if (filteredFiles.length === 0) return [];
    const commands = [\`${packagePrefix}prettier --cache --write \${filteredFiles.join(' ')}\`];
    if (filteredFiles.some(file => file.endsWith('package.json'))) {
      commands.push('${packagePrefix}sort-package-json');
    }
    return commands;
  },
  './**/migration.sql': (files) => {
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('Warnings:')) {
      return [
        \`!!! Migration SQL file (\${path.relative('', file)}) contains warnings !!! Solve the warnings and commit again.\`,
      ];
    }
  }
  return [];
},`);
  if (config.doesContainsPubspecYaml) {
    lines.push(`
  './{lib,test,test_driver}/**/*.dart': files => {
    const filteredFiles = files.filter(file => !file.includes('generated'))
      .filter(file => !file.endsWith('.freezed.dart') && !file.endsWith('.g.dart'));
    if (filteredFiles.length === 0) return [];
    return [\`flutter format \${filteredFiles.join(' ')}\`];
  },`);
  }
  if (config.doesContainsPoetryLock) {
    lines.push(`
  './**/*.py': [
    'poetry run isort --profile black --filter-files',
    'poetry run black',
    'poetry run flake8'
  ],`);
  }

  const newContent = `const path = require('path');
${config.doesContainsJavaScript || config.doesContainsTypeScript ? "const micromatch = require('micromatch');\n" : ''}
module.exports = {${lines.join('')}
};
`;

  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.lintstagedrc.js'), { force: true }));
  await promisePool.run(() => fs.promises.rm(path.resolve(config.dirPath, '.lintstagedrc.json'), { force: true }));
  await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
}

function getEslintKey(config: PackageConfig): string {
  const dirs = getSrcDirs(config);
  return `./{${dirs.join(',')}}/**/*.{${extensions.eslint.join(',')}}`;
}

function getEslintFilterForPrettier(config: PackageConfig): string {
  return config.doesContainsJavaScript || config.doesContainsTypeScript
    ? `\n
    filteredFiles = filteredFiles.map((file) => path.relative('', file));
    filteredFiles = micromatch.not(filteredFiles, '${getEslintKey(config)}');
    filteredFiles = filteredFiles.map((file) => path.resolve(file));`
    : '';
}
