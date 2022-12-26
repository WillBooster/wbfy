import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { sortKeys } from '../utils/objectUtil';
import { promisePool } from '../utils/promisePool';

const rootJsonObj = {
  compilerOptions: {
    target: 'esnext',
    module: 'esnext',
    moduleResolution: 'node',
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
    '__tests__/**/*',
    'scripts/**/*',
    'packages/*/src/**/*',
    'packages/*/__tests__/**/*',
    'packages/*/scripts/**/*',
  ],
};

const subJsonObj = {
  compilerOptions: {
    target: 'esnext',
    module: 'esnext',
    moduleResolution: 'node',
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
  include: ['src/**/*', '__tests__/**/*', 'scripts/**/*'],
};

export async function generateTsconfig(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  return logger.function('generateTsconfig', async () => {
    if (rootConfig.depending.blitz) return;

    let newSettings: any = cloneDeep(config.root ? rootJsonObj : subJsonObj);
    if (!config.containingJsxOrTsx && !config.containingJsxOrTsxInPackages) {
      delete newSettings.compilerOptions.jsx;
    }
    if (config.root && !config.containingSubPackageJsons) {
      newSettings.include = newSettings.include.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
    }

    const filePath = path.resolve(config.dirPath, 'tsconfig.json');
    try {
      const existingContent = await fs.promises.readFile(filePath, 'utf8');
      const oldSettings = JSON.parse(existingContent);
      if (oldSettings.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
        delete oldSettings.extends;
      }
      delete newSettings?.compilerOptions?.target;
      delete newSettings?.compilerOptions?.module;
      if (oldSettings.jsx) {
        delete newSettings.jsx;
      }
      newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: overwriteMerge });
      newSettings.include = newSettings.include.filter((dirPath: string) => !dirPath.includes('@types'));
    } catch {
      // do nothing
    }
    sortKeys(newSettings.compilerOptions);
    const newContent = JSON.stringify(newSettings);
    await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
  });
}
