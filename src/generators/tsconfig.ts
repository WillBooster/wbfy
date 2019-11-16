import path from 'path';
import fs from 'fs-extra';
import merge from 'deepmerge';
import { PackageConfig } from '../types/packageConfig';
import { overwriteMerge } from '../utils/mergeUtil';

function generateRootJsonObj(): any {
  return {
    extends: './node_modules/@willbooster/tsconfig/tsconfig.json',
    compilerOptions: {
      jsx: 'react',
      typeRoots: ['./node_modules/@types', './@types'],
    },
    include: ['src/**/*', '__tests__/**/*', 'packages/*/src/**/*', 'packages/*/__tests__/**/*'],
  };
}

function generateSubJsonObj(): any {
  return {
    extends: '../../tsconfig.json',
    compilerOptions: {
      module: 'commonjs',
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
  if (!config.depending.tsnode) {
    delete jsonObj.compilerOptions.module;
  }

  const filePath = path.resolve(config.dirPath, 'tsconfig.json');
  if (fs.existsSync(filePath)) {
    const existingContent = fs.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      jsonObj = merge(existingJsonObj, jsonObj, { arrayMerge: overwriteMerge });
    } catch (e) {
      // do nothing
    }
  }
  await fs.outputFile(filePath, JSON.stringify(jsonObj));
  console.log(`Generated ${filePath}`);
}
