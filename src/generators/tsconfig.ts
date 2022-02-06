import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import merge from 'deepmerge';
import cloneDeep from 'lodash.clonedeep';

import { FsUtil } from '../utils/fsUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { PackageConfig } from '../utils/packageConfig';

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
    'packages/*/src/**/*',
    'packages/*/__tests__/**/*',
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
  include: ['src/**/*', '__tests__/**/*', '../../node_modules/@types', '../../@types', './@types'],
};

export async function generateTsconfig(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  if (rootConfig.depending.blitz) return;

  let newJsonObj: any = cloneDeep(config.root ? rootJsonObj : subJsonObj);
  if (!config.containingJsxOrTsx && !config.containingJsxOrTsxInPackages) {
    delete newJsonObj.compilerOptions.jsx;
  }
  if (config.root && !config.containingSubPackageJsons) {
    newJsonObj.include = newJsonObj.include.filter((dirPath: string) => !dirPath.startsWith('packages/*/'));
  }
  if (!config.root && (config.depending.jestPlaywrightPreset || rootConfig.depending.jestPlaywrightPreset)) {
    const relativeDirPath = path.relative(config.dirPath, rootConfig.dirPath);
    newJsonObj.include.push(
      ...[
        path.join(relativeDirPath, 'node_modules/jest-playwright-preset/types'),
        path.join(relativeDirPath, 'node_modules/expect-playwright'),
      ]
    );
  }

  const filePath = path.resolve(config.dirPath, 'tsconfig.json');
  if (fs.existsSync(filePath)) {
    const existingContent = await fsp.readFile(filePath, 'utf-8');
    try {
      const existingJsonObj = JSON.parse(existingContent);
      if (existingJsonObj.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
        delete existingJsonObj.extends;
      }
      delete existingJsonObj.compilerOptions?.typeRoots;
      delete newJsonObj?.compilerOptions?.target;
      delete newJsonObj?.compilerOptions?.module;
      if (existingJsonObj.jsx) {
        delete newJsonObj.jsx;
      }
      if (!config.depending.blitz) {
        delete newJsonObj.include;
      }
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj], { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  const sortedCompilerOptions: Record<string, unknown> = {};
  for (const key of Object.keys(newJsonObj.compilerOptions).sort()) {
    sortedCompilerOptions[key] = newJsonObj.compilerOptions[key];
  }
  newJsonObj.compilerOptions = sortedCompilerOptions;
  await FsUtil.generateFile(filePath, JSON.stringify(newJsonObj));
}
