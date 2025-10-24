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

const rootJsonObj = {
  compilerOptions: {
    target: 'ES2022', // because decorators should be transpiled to ES2022 on Node.js
    module: 'ESNext',
    moduleResolution: 'Node',
    jsx: 'react-jsx',
    alwaysStrict: true,
    strict: true,
    noUncheckedIndexedAccess: true, // for @typescript-eslint/prefer-nullish-coalescing
    skipLibCheck: true, // because libraries may have broken types
    allowSyntheticDefaultImports: true, // allow `import React from 'react'`
    esModuleInterop: true, // allow default import from CommonJS/AMD/UMD modules
    resolveJsonModule: true, // allow to import JSON files
    declaration: true,
    sourceMap: true,
    importHelpers: false,
    erasableSyntaxOnly: true,
    outDir: 'dist',
    typeRoots: ['./node_modules/@types', './@types'],
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
  compilerOptions: {
    target: 'ES2022', // because decorators should be transpiled to ES2022 on Node.js
    module: 'ESNext',
    moduleResolution: 'Node',
    jsx: 'react-jsx',
    alwaysStrict: true,
    strict: true,
    noUncheckedIndexedAccess: true, // for @typescript-eslint/prefer-nullish-coalescing
    skipLibCheck: true, // because libraries may have broken types
    allowSyntheticDefaultImports: true, // allow `import React from 'react'`
    esModuleInterop: true, // allow default import from CommonJS/AMD/UMD modules
    resolveJsonModule: true, // allow to import JSON files
    declaration: true,
    sourceMap: true,
    importHelpers: false,
    erasableSyntaxOnly: true,
    outDir: 'dist',
    typeRoots: ['../../node_modules/@types', '../../@types', './@types'],
  },
  exclude: ['test/fixtures'],
  include: ['scripts/**/*', 'src/**/*', 'test/**/*'],
};

export async function generateTsconfig(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateTsconfig', async () => {
    if (config.depending.blitz || config.depending.next) return;

    let newSettings = cloneDeep(config.isRoot ? rootJsonObj : subJsonObj) as TsConfigJson;
    if (!config.doesContainJsxOrTsx && !config.doesContainJsxOrTsxInPackages) {
      delete newSettings.compilerOptions?.jsx;
    }
    if (config.isRoot && !config.doesContainSubPackageJsons) {
      newSettings.include = newSettings.include?.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
      newSettings.exclude = newSettings.exclude?.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
    }
    if (config.isEsmPackage) {
      newSettings.compilerOptions = {
        ...newSettings.compilerOptions,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
      };
    }

    const filePath = path.resolve(config.dirPath, 'tsconfig.json');
    try {
      const existingContent = await fs.promises.readFile(filePath, 'utf8');
      const oldSettings = JSON.parse(existingContent) as TsConfigJson;
      if (oldSettings.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
        delete oldSettings.extends;
      }
      // Don't modify "target", "module" and "moduleResolution".
      delete newSettings.compilerOptions?.target;
      if (!config.isEsmPackage) {
        delete newSettings.compilerOptions?.module;
        delete newSettings.compilerOptions?.moduleResolution;
      }
      if (oldSettings.compilerOptions?.jsx) {
        delete newSettings.compilerOptions?.jsx;
      }
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
