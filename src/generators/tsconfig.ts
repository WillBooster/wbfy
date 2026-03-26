import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';
import type { TsConfigJson } from 'type-fest';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { combineMerge } from '../utils/mergeUtil.js';
import { sortKeys } from '../utils/objectUtil.js';
import { promisePool } from '../utils/promisePool.js';
import { getTsconfigExtends } from '../utils/tsconfigBase.js';

const rootJsonObj = {
  extends: '@tsconfig/node-lts/tsconfig.json',
  compilerOptions: {
    alwaysStrict: true,
    noUncheckedIndexedAccess: true, // for @typescript-eslint/prefer-nullish-coalescing
    allowSyntheticDefaultImports: true, // allow `import React from 'react'`
    esModuleInterop: true, // allow default import from CommonJS/AMD/UMD modules
    resolveJsonModule: true, // allow to import JSON files
    declaration: true,
    sourceMap: true,
    importHelpers: false,
    erasableSyntaxOnly: true,
    rewriteRelativeImportExtensions: true,
    outDir: 'dist',
    typeRoots: ['./node_modules/@types', './@types'],
    verbatimModuleSyntax: true,
  },
  exclude: ['packages/*/test/fixtures', 'test/fixtures'],
  include: [
    'packages/*/scripts/**/*',
    'packages/*/src/**/*',
    'packages/*/test/**/*',
    'scripts/**/*',
    'src/**/*',
    'test/**/*',
  ],
};

const subJsonObj = {
  extends: '@tsconfig/node-lts/tsconfig.json',
  compilerOptions: {
    alwaysStrict: true,
    noUncheckedIndexedAccess: true, // for @typescript-eslint/prefer-nullish-coalescing
    allowSyntheticDefaultImports: true, // allow `import React from 'react'`
    esModuleInterop: true, // allow default import from CommonJS/AMD/UMD modules
    resolveJsonModule: true, // allow to import JSON files
    declaration: true,
    sourceMap: true,
    importHelpers: false,
    erasableSyntaxOnly: true,
    rewriteRelativeImportExtensions: true,
    outDir: 'dist',
    typeRoots: ['../../node_modules/@types', '../../@types', './@types'],
    verbatimModuleSyntax: true,
  },
  exclude: ['test/fixtures'],
  include: ['scripts/**/*', 'src/**/*', 'test/**/*'],
};

export async function generateTsconfig(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateTsconfig', async () => {
    if (config.depending.blitz || config.depending.next) return;

    let newSettings = cloneDeep(config.isRoot ? rootJsonObj : subJsonObj) as TsConfigJson;
    newSettings.extends = getTsconfigExtends(config);
    if (config.depending.reactNative) {
      delete newSettings.compilerOptions?.verbatimModuleSyntax;
    }
    if (!config.doesContainJsxOrTsx && !config.doesContainJsxOrTsxInPackages) {
      delete newSettings.compilerOptions?.jsx;
    } else if (!config.isBun && !config.depending.reactNative) {
      newSettings.compilerOptions = { ...newSettings.compilerOptions, jsx: 'react-jsx' };
    }
    if (!config.isBun && !config.depending.reactNative) {
      newSettings.compilerOptions = {
        ...newSettings.compilerOptions,
        module: config.isEsmPackage ? 'NodeNext' : 'ESNext',
        moduleResolution: config.isEsmPackage ? 'NodeNext' : 'Node',
      };
    }
    if (config.isRoot && !config.doesContainSubPackageJsons) {
      newSettings.include = newSettings.include?.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
      newSettings.exclude = newSettings.exclude?.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
    }

    const filePath = path.resolve(config.dirPath, 'tsconfig.json');
    try {
      const existingContent = await fs.promises.readFile(filePath, 'utf8');
      const oldSettings = JSON.parse(existingContent) as TsConfigJson;
      delete oldSettings.extends;
      delete oldSettings.compilerOptions?.jsx;
      delete oldSettings.compilerOptions?.module;
      delete oldSettings.compilerOptions?.moduleResolution;
      delete oldSettings.compilerOptions?.verbatimModuleSyntax;
      newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
      newSettings.include = newSettings.include?.filter(
        (dirPath: string) =>
          !dirPath.includes('@types') && !dirPath.includes('__tests__/') && !dirPath.includes('tests/')
      );
    } catch {
      // do nothing
    }
    sortKeys(newSettings);
    newSettings.include?.sort();
    const newContent = JSON.stringify(newSettings);
    // Don't use old decorator
    delete newSettings.compilerOptions?.experimentalDecorators;
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
