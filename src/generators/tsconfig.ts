import path from 'path';
import fse from 'fs-extra';
import merge from 'deepmerge';
import { PackageConfig } from '../utils/packageConfig';
import { overwriteMerge } from '../utils/mergeUtil';
import { FsUtil } from '../utils/fsUtil';

function generateRootJsonObj(): any {
  return {
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
      importHelpers: true,
      outDir: 'dist',
      typeRoots: ['./node_modules/@types', './@types'],
    },
    include: ['src/**/*', '__tests__/**/*', 'packages/*/src/**/*', 'packages/*/__tests__/**/*'],
  };
}

function generateSubJsonObj(): any {
  return {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: 'dist',
      typeRoots: ['../../node_modules/@types', './@types'],
    },
    include: ['src/**/*', '__tests__/**/*'],
  };
}

export async function generateTsconfig(config: PackageConfig): Promise<void> {
  let jsonObj = config.root ? generateRootJsonObj() : generateSubJsonObj();
  if (!config.containingJsxOrTsx) {
    delete jsonObj.compilerOptions.jsx;
  }
  if (config.depending.node) {
    // We expect Node version is 10+
    jsonObj.compilerOptions.target = 'es2018';
    jsonObj.compilerOptions.module = 'commonjs';
  }

  const filePath = path.resolve(config.dirPath, 'tsconfig.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      if (existingJsonObj.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
        delete existingJsonObj.extends;
      }
      if (!config.depending.node) {
        delete jsonObj?.compilerOptions?.target;
        delete jsonObj?.compilerOptions?.module;
      }
      jsonObj = merge.all([jsonObj, existingJsonObj, jsonObj], { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  await FsUtil.generateFile(filePath, JSON.stringify(jsonObj));
}
