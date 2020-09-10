import path from 'path';
import merge from 'deepmerge';
import fse from 'fs-extra';
import { PackageConfig } from '../utils/packageConfig';
import { overwriteMerge } from '../utils/mergeUtil';
import { FsUtil } from '../utils/fsUtil';

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
    typeRoots: ['./node_modules/@types', './@types'],
  },
  include: ['src/**/*', '__tests__/**/*', 'packages/*/src/**/*', 'packages/*/__tests__/**/*'],
};

const subJsonObj = {
  extends: '../../tsconfig.json',
  compilerOptions: {
    outDir: 'dist',
    typeRoots: ['../../node_modules/@types', '../../@types', './@types'],
  },
  include: ['src/**/*', '__tests__/**/*'],
};

export async function generateTsconfig(config: PackageConfig): Promise<void> {
  let newJsonObj: any = Object.assign({}, config.root ? rootJsonObj : subJsonObj);
  if (!config.containingJsxOrTsx) {
    delete newJsonObj.compilerOptions.jsx;
  }
  if (config.depending.tsnode) {
    // We expect Node version is 12+
    newJsonObj.compilerOptions.target = 'es2019';
    newJsonObj.compilerOptions.module = 'commonjs';
  }

  const filePath = path.resolve(config.dirPath, 'tsconfig.json');
  if (fse.existsSync(filePath)) {
    const existingContent = fse.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      if (existingJsonObj.extends === './node_modules/@willbooster/tsconfig/tsconfig.json') {
        delete existingJsonObj.extends;
      }
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
