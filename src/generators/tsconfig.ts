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
  extends: '../../tsconfig.json',
  compilerOptions: {
    outDir: 'dist',
  },
  include: ['src/**/*', '__tests__/**/*', '../../node_modules/@types', '../../@types', './@types'],
};

export async function generateTsconfig(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  let newJsonObj: any = cloneDeep(config.root ? rootJsonObj : subJsonObj);
  if (!config.containingJsxOrTsx && !config.containingJsxOrTsxInPackages) {
    delete newJsonObj.compilerOptions.jsx;
  }
  if (config.depending.tsnode) {
    // We expect Node version is 12+
    newJsonObj.compilerOptions.target = 'es2019';
    newJsonObj.compilerOptions.module = 'commonjs';
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
    const existingContent = (await fsp.readFile(filePath)).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      if (existingJsonObj.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
        delete existingJsonObj.extends;
      }
      delete existingJsonObj.compilerOptions?.typeRoots;
      if (!config.depending.tsnode) {
        delete newJsonObj?.compilerOptions?.target;
        delete newJsonObj?.compilerOptions?.module;
      }
      newJsonObj = merge.all([newJsonObj, existingJsonObj, newJsonObj], { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(newJsonObj));
}
