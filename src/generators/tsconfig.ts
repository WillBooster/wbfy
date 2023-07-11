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
    target: 'ESNext',
    module: 'ESNext',
    moduleResolution: 'Node',
    jsx: 'react-jsx',
    alwaysStrict: true,
    strict: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    declaration: true,
    sourceMap: true,
    importHelpers: false,
    outDir: 'dist',
    typeRoots: ['./node_modules/@types', './@types'],
  },
  include: [
    'src/**/*',
    'tests/**/*',
    'scripts/**/*',
    'packages/*/src/**/*',
    'packages/*/tests/**/*',
    'packages/*/scripts/**/*',
  ],
};

const subJsonObj = {
  compilerOptions: {
    target: 'ESNext',
    module: 'ESNext',
    moduleResolution: 'Node',
    jsx: 'react-jsx',
    alwaysStrict: true,
    strict: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    declaration: true,
    sourceMap: true,
    importHelpers: false,
    outDir: 'dist',
    typeRoots: ['../../node_modules/@types', '../../@types', './@types'],
  },
  include: ['src/**/*', 'tests/**/*', 'scripts/**/*'],
};

export async function generateTsconfig(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateTsconfig', async () => {
    if (rootConfig.depending.blitz) return;

    let newSettings = cloneDeep(config.root ? rootJsonObj : subJsonObj) as TsConfigJson;
    if (!config.containingJsxOrTsx && !config.containingJsxOrTsxInPackages) {
      delete newSettings.compilerOptions?.jsx;
    }
    if (config.root && !config.containingSubPackageJsons) {
      newSettings.include = newSettings.include?.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
    }
    if (config.esmPackage) {
      newSettings.compilerOptions = { ...newSettings.compilerOptions, moduleResolution: 'NodeNext' };
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
      delete newSettings.compilerOptions?.module;
      delete newSettings.compilerOptions?.moduleResolution;
      if (oldSettings.compilerOptions?.jsx) {
        delete newSettings.compilerOptions?.jsx;
      }
      newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: combineMerge });
      newSettings.include = newSettings.include?.filter(
        (dirPath: string) => !dirPath.includes('@types') && !dirPath.includes('__tests__')
      );
    } catch {
      // do nothing
    }
    sortKeys(newSettings.compilerOptions ?? {});
    newSettings.include?.sort();
    const newContent = JSON.stringify(newSettings);
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
