import path from 'path';
import * as fs from 'fs';
import merge from 'deepmerge';
import fse from 'fs-extra';
import { PackageConfig } from '../utils/packageConfig';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { spawnSync } from '../utils/spawnUtil';
import { overwriteMerge } from '../utils/mergeUtil';
import { Extensions } from '../utils/extensions';
import { EslintUtil } from '../utils/eslintUtil';

const scriptsWithoutLerna = {
  cleanup: 'yarn format && yarn lint-fix',
  format: `sort-package-json && yarn prettier`,
  lint: `eslint "./{packages/*/,}{src,__tests__}/**/*.{${Extensions.eslint.join(',')}}"`,
  'lint-fix': 'yarn lint --fix',
  prettier: `prettier --write "**/{.*/,}*.{${Extensions.prettier.join(',')}}" "!**/test-fixtures/**"`,
  typecheck: 'tsc --noEmit',
};

const scriptsWithLerna = merge(
  { ...scriptsWithoutLerna },
  {
    format: `yarn sort-package-json && yarn prettier`,
    'sort-package-json': 'sort-package-json && yarn lerna exec sort-package-json --stream',
    typecheck: 'yarn lerna run typecheck --stream',
  }
);

const devDeps: { [prop: string]: string[] } = {
  '@willbooster/eslint-config-js': [
    '@willbooster/eslint-config-js',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    'eslint-plugin-prettier',
  ],
  '@willbooster/eslint-config-js-react': [
    '@willbooster/eslint-config-js',
    '@willbooster/eslint-config-js-react',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    'eslint-plugin-prettier',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
  ],
  '@willbooster/eslint-config-ts': [
    '@willbooster/eslint-config-ts',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    'eslint-plugin-prettier',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
  ],
  '@willbooster/eslint-config-ts-react': [
    '@willbooster/eslint-config-ts',
    '@willbooster/eslint-config-ts-react',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    'eslint-plugin-prettier',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
  ],
  '../../.eslintrc.json': [],
};

export async function generatePackageJson(
  config: PackageConfig,
  allConfigs: PackageConfig[],
  skipAddingDeps: boolean
): Promise<void> {
  const filePath = path.resolve(config.dirPath, 'package.json');
  const jsonText = fse.readFileSync(filePath).toString();
  const jsonObj = JSON.parse(jsonText);
  jsonObj.scripts = jsonObj.scripts || {};
  jsonObj.dependencies = jsonObj.dependencies || {};
  jsonObj.devDependencies = jsonObj.devDependencies || {};
  jsonObj.peerDependencies = jsonObj.peerDependencies || {};

  // Fix deprecated things
  if (jsonObj.author === 'WillBooster LLC') {
    jsonObj.author = 'WillBooster Inc.';
  }
  delete jsonObj.scripts['sort-package-json'];
  delete jsonObj.scripts['sort-all-package-json'];
  delete jsonObj.dependencies['tslib'];
  delete jsonObj.devDependencies['@willbooster/eslint-config'];
  delete jsonObj.devDependencies['@willbooster/eslint-config-react'];
  delete jsonObj.devDependencies['@willbooster/tsconfig'];

  jsonObj.prettier = '@willbooster/prettier-config';

  let dependencies = [] as string[];
  let devDependencies = [] as string[];

  if (config.root) {
    // Cannot remove a version prefix in sub-packages because a version prefix is required to refer to another sub-package
    [jsonObj.dependencies, jsonObj.devDependencies, jsonObj.peerDependencies].forEach(deps =>
      removeVersionPrefix(deps)
    );

    devDependencies.push(
      'husky',
      'lint-staged',
      'prettier',
      'sort-package-json',
      '@willbooster/prettier-config',
      '@willbooster/renovate-config'
    );

    if (config.containingSubPackages) {
      devDependencies.push('lerna');
      jsonObj.workspaces = jsonObj.workspaces || {};
      if (jsonObj.workspaces instanceof Array) {
        jsonObj.workspaces = {};
      }
      jsonObj.workspaces = merge(
        jsonObj.workspaces,
        {
          packages: ['packages/*'],
        },
        { arrayMerge: overwriteMerge }
      );
    }

    for (const config of allConfigs) {
      if (config.eslintBase) {
        devDependencies.push(...devDeps[config.eslintBase]);
      }
    }
  }

  if (config.willBoosterConfigs) {
    dependencies = dependencies.filter(dep => !dep.includes('@willbooster/'));
    devDependencies = devDependencies.filter(dep => !dep.includes('@willbooster/'));
  }

  if (!jsonObj.name) {
    jsonObj.name = path.basename(config.dirPath);
  }

  if (config.containingSubPackages) {
    jsonObj.private = true;
  }

  if (!jsonObj.license) {
    jsonObj.license = 'UNLICENSED';
  }

  jsonObj.scripts = merge(jsonObj.scripts, config.containingSubPackages ? scriptsWithLerna : scriptsWithoutLerna);
  jsonObj.scripts.prettier += generatePrettierSuffix(config.dirPath);

  if (!config.containingTypeScript) {
    delete jsonObj.scripts.typecheck;
  }

  if ((!config.containingJavaScript && !config.containingTypeScript) || config.containingPubspecYaml) {
    delete jsonObj.scripts.lint;
    delete jsonObj.scripts['lint-fix'];
    jsonObj.scripts.cleanup = jsonObj.scripts.cleanup.substring(0, jsonObj.scripts.cleanup.lastIndexOf(' && '));
    console.log(jsonObj.scripts.cleanup);
  } else {
    jsonObj.scripts['lint-fix'] += EslintUtil.getLintFixSuffix(config);
  }

  if (config.containingPubspecYaml) {
    jsonObj.scripts.lint = 'flutter analyze';
    const dirs = ['lib', 'test', 'test_driver'].filter(dir => fs.existsSync(path.resolve(config.dirPath, dir)));
    if (dirs.length > 0) {
      jsonObj.scripts['flutter-format'] = `flutter format $(find ${dirs.join(
        ' '
      )} -name generated -prune -o -name '*.dart' -print)`;
      jsonObj.scripts.format += ` && yarn flutter-format`;
    }
    if (config.containingSubPackages) {
      jsonObj.scripts.format += ` && yarn lerna run flutter-format`;
    }
  }

  if (!Object.keys(jsonObj.dependencies).length) {
    delete jsonObj.dependencies;
  }
  if (!Object.keys(jsonObj.devDependencies).length) {
    delete jsonObj.devDependencies;
  }
  if (!Object.keys(jsonObj.peerDependencies).length) {
    delete jsonObj.peerDependencies;
  }

  fse.outputFileSync(filePath, JSON.stringify(jsonObj));

  let yarnInstallRequired = true;
  if (!skipAddingDeps) {
    if (dependencies.length && dependencies.some(dep => !jsonObj.dependencies[dep])) {
      spawnSync('yarn', ['add', '-W', ...new Set(dependencies)], config.dirPath);
      yarnInstallRequired = false;
    }
    if (devDependencies.length && devDependencies.some(dep => !jsonObj.devDependencies[dep])) {
      spawnSync('yarn', ['add', '-W', '-D', ...new Set(devDependencies)], config.dirPath);
      yarnInstallRequired = false;
    }
  }
  if (yarnInstallRequired) {
    spawnSync('yarn', ['install'], config.dirPath);
  }
}

function removeVersionPrefix(deps: any): void {
  for (const [key, value] of Object.entries(deps)) {
    if (typeof value === 'string' && value[0] === '^') {
      deps[key] = value.substring(1);
    }
  }
}

function generatePrettierSuffix(dirPath: string): string {
  const filePath = path.resolve(dirPath, '.prettierignore');
  const existingContent = fse.readFileSync(filePath).toString();
  const index = existingContent.indexOf(IgnoreFileUtil.separatorPrefix);
  if (index < 0) return '';

  const originalContent = existingContent.substring(0, index);
  const lines = originalContent
    .split('\n')
    .map(line => {
      const newLine = line.trim();
      return newLine.endsWith('/') ? newLine.slice(0, -1) : newLine;
    })
    .filter(l => l && !l.startsWith('#') && !l.includes('/'));

  return lines.map(line => ` \\"!**/${line}/**\\"`).join('');
}
