import fs from 'fs';
import path from 'path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';

import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { sortKeys } from '../utils/objectUtil';
import { PackageConfig } from '../utils/packageConfig';
import { promisePool } from '../utils/promisePool';

const rootJsonObj = {
  compilerOptions: {
    target: 'esnext',
    module: 'esnext',
    moduleResolution: 'node',
    jsx: 'react',
    alwaysStrict: true,
    strict: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    sourceMap: true,
    importHelpers: false,
    outDir: 'dist',
  },
  include: [
    'src/**/*',
    '__tests__/**/*',
    'scripts/**/*',
    'packages/*/src/**/*',
    'packages/*/__tests__/**/*',
    'packages/*/scripts/**/*',
    './node_modules/@types',
    './@types',
  ],
};

const subJsonObj = {
  compilerOptions: {
    target: 'esnext',
    module: 'esnext',
    moduleResolution: 'node',
    jsx: 'react',
    alwaysStrict: true,
    strict: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    sourceMap: true,
    importHelpers: false,
    outDir: 'dist',
  },
  include: ['src/**/*', '__tests__/**/*', 'scripts/**/*', '../../node_modules/@types', '../../@types', './@types'],
};

export async function generateTsconfig(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  if (rootConfig.depending.blitz) return;

  let newSettings: any = cloneDeep(config.root ? rootJsonObj : subJsonObj);
  if (!config.containingJsxOrTsx && !config.containingJsxOrTsxInPackages) {
    delete newSettings.compilerOptions.jsx;
  }
  if (config.root && !config.containingSubPackageJsons) {
    newSettings.include = newSettings.include.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
  }
  if (!config.root && (config.depending.jestPlaywrightPreset || rootConfig.depending.jestPlaywrightPreset)) {
    const relativeDirPath = path.relative(config.dirPath, rootConfig.dirPath);
    newSettings.include.push(
      ...[
        path.join(relativeDirPath, 'node_modules/jest-playwright-preset/types'),
        path.join(relativeDirPath, 'node_modules/expect-playwright'),
      ]
    );
  }

  const filePath = path.resolve(config.dirPath, 'tsconfig.json');
  try {
    const existingContent = await fs.promises.readFile(filePath, 'utf-8');
    const oldSettings = JSON.parse(existingContent);
    if (oldSettings.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
      delete oldSettings.extends;
    }
    delete oldSettings.compilerOptions?.typeRoots;
    delete newSettings?.compilerOptions?.target;
    delete newSettings?.compilerOptions?.module;
    if (oldSettings.jsx) {
      delete newSettings.jsx;
    }
    if (config.depending.blitz) {
      delete newSettings.include;
    }
    newSettings = merge.all([newSettings, oldSettings, newSettings], { arrayMerge: overwriteMerge });
  } catch (e) {
    // do nothing
  }
  sortKeys(newSettings.compilerOptions);
  const newContent = JSON.stringify(newSettings);
  await promisePool.run(() => FsUtil.generateFile(filePath, newContent));
}
