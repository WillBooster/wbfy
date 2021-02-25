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
  format: `sort-package-json && yarn prettify`,
  lint: `eslint --color "./{src,__tests__}/**/*.{${Extensions.eslint.join(',')}}"`,
  'lint-fix': 'yarn lint --fix',
  prettify: `prettier --color --write "**/{.*/,}*.{${Extensions.prettier.join(',')}}" "!**/test-fixtures/**"`,
  typecheck: 'tsc --noEmit --Pretty',
};

const scriptsWithLerna = merge(
  { ...scriptsWithoutLerna },
  {
    format: `sort-package-json && yarn prettify && lerna run format`,
    lint: `lerna run lint`,
    'lint-fix': 'lerna run lint-fix',
    prettify: `prettier --color --write "**/{.*/,}*.{${Extensions.prettier.join(
      ','
    )}}" "!**/packages/**" "!**/test-fixtures/**"`,
    typecheck: 'lerna run typecheck',
  }
);

const scriptsWithWorkspaceTool = merge(
  { ...scriptsWithoutLerna },
  {
    format: `sort-package-json && yarn prettify && lerna run format`,
    lint: `lerna run lint`,
    'lint-fix': 'lerna run lint-fix',
    prettify: `prettier --color --write "**/{.*/,}*.{${Extensions.prettier.join(
      ','
    )}}" "!**/packages/**" "!**/test-fixtures/**"`,
    typecheck: 'lerna run typecheck',
  }
);

const devDeps: { [prop: string]: string[] } = {
  '@willbooster/eslint-config-js': [
    '@willbooster/eslint-config-js',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
  ],
  '@willbooster/eslint-config-js-react': [
    '@willbooster/eslint-config-js-react',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
  ],
  '@willbooster/eslint-config-ts': [
    '@willbooster/eslint-config-ts',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
  ],
  '@willbooster/eslint-config-ts-react': [
    '@willbooster/eslint-config-ts-react',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
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
): Promise<boolean> {
  const filePath = path.resolve(config.dirPath, 'package.json');
  const jsonText = fse.readFileSync(filePath).toString();
  const jsonObj = JSON.parse(jsonText);
  jsonObj.scripts = jsonObj.scripts || {};
  jsonObj.dependencies = jsonObj.dependencies || {};
  jsonObj.devDependencies = jsonObj.devDependencies || {};
  jsonObj.peerDependencies = jsonObj.peerDependencies || {};

  // TODO: remove the following migration code in future
  if (jsonObj.author === 'WillBooster LLC') {
    jsonObj.author = 'WillBooster Inc.';
  }
  delete jsonObj.scripts['sort-package-json'];
  delete jsonObj.scripts['sort-all-package-json'];
  delete jsonObj.dependencies['tslib'];
  delete jsonObj.devDependencies['@willbooster/eslint-config'];
  delete jsonObj.devDependencies['@willbooster/eslint-config-react'];
  delete jsonObj.devDependencies['@willbooster/tsconfig'];
  const eslintPluginPrettierRemoved = jsonObj.devDependencies['eslint-plugin-prettier'];
  delete jsonObj.devDependencies['eslint-plugin-prettier'];
  delete jsonObj.scripts['flutter-format'];
  delete jsonObj.scripts['format-flutter'];
  delete jsonObj.scripts['python-format'];
  delete jsonObj.scripts['format-python'];
  delete jsonObj.scripts['prettier'];
  for (const deps of Object.values(devDeps)) {
    for (const dep of deps) {
      delete jsonObj.devDependencies[dep];
    }
  }

  if (jsonObj.name !== '@willbooster/prettier-config') {
    jsonObj.prettier = '@willbooster/prettier-config';
  }

  jsonObj.scripts = merge(
    jsonObj.scripts,
    config.containingSubPackageJsons
      ? config.containingYarnrcYml
        ? scriptsWithWorkspaceTool
        : scriptsWithLerna
      : scriptsWithoutLerna
  );
  jsonObj.scripts.prettify += generatePrettierSuffix(config.dirPath);

  let dependencies = [] as string[];
  let devDependencies = ['prettier', 'sort-package-json', '@willbooster/prettier-config'];

  if (config.root) {
    // Cannot remove a version prefix in sub-packages because a version prefix is required to refer to another sub-package
    [jsonObj.dependencies, jsonObj.devDependencies, jsonObj.peerDependencies].forEach((deps) =>
      removeVersionPrefix(deps)
    );

    devDependencies.push('husky', 'lint-staged', '@willbooster/renovate-config');
    if (
      config.containingJavaScript ||
      config.containingJavaScriptInPackages ||
      config.containingTypeScript ||
      config.containingTypeScriptInPackages
    ) {
      devDependencies.push('eslint');
      if (config.containingYarnrcYml) {
        devDependencies.push('eslint-import-resolver-node');
      }
      if (config.containingTypeScriptInPackages) {
        devDependencies.push('@typescript-eslint/parser');
      }
    }

    if (config.containingSubPackageJsons) {
      devDependencies.push('lerna');
      if (config.containingYarnrcYml) {
        jsonObj.workspaces = ['packages/*'];
      } else {
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
    }
  }

  if (
    config.containingJavaScript ||
    config.containingJavaScriptInPackages ||
    config.containingTypeScript ||
    config.containingTypeScriptInPackages
  ) {
    devDependencies.push('micromatch');
  }

  if (config.containingTypeScript || config.containingTypeScriptInPackages) {
    devDependencies.push('typescript');
  }

  if (config.eslintBase) {
    devDependencies.push(...devDeps[config.eslintBase]);
  }

  if (config.willBoosterConfigs) {
    dependencies = dependencies.filter((dep) => !dep.includes('@willbooster/'));
    devDependencies = devDependencies.filter((dep) => !dep.includes('@willbooster/'));
  }

  if (!jsonObj.name) {
    jsonObj.name = path.basename(config.dirPath);
  }

  if (config.containingSubPackageJsons) {
    jsonObj.private = true;
  }

  if (!jsonObj.license) {
    jsonObj.license = 'UNLICENSED';
  }

  if (!config.containingTypeScript && !config.containingTypeScriptInPackages) {
    delete jsonObj.scripts.typecheck;
  }

  if (!config.containingSubPackageJsons) {
    if (!config.containingJavaScript && !config.containingTypeScript) {
      delete jsonObj.scripts.lint;
      delete jsonObj.scripts['lint-fix'];
      jsonObj.scripts.cleanup = jsonObj.scripts.cleanup.replace(' && yarn lint-fix', '');
    } else {
      jsonObj.scripts['lint-fix'] += EslintUtil.getLintFixSuffix(config);
    }

    if (config.containingPubspecYaml) {
      jsonObj.scripts.lint = 'flutter analyze';
      jsonObj.scripts['lint-fix'] = 'yarn lint';
      const dirs = ['lib', 'test', 'test_driver'].filter((dir) => fs.existsSync(path.resolve(config.dirPath, dir)));
      if (dirs.length > 0) {
        jsonObj.scripts['format-code'] = `flutter format $(find ${dirs.join(
          ' '
        )} -name generated -prune -o -name '*.freezed.dart' -prune -o -name '*.g.dart' -prune -o -name '*.dart' -print)`;
        jsonObj.scripts.format += ` && yarn format-code`;
      }
    }

    if (config.containingPoetryLock) {
      jsonObj.scripts.postinstall = 'poetry install';
      const dirNames = fs.readdirSync(config.dirPath).filter((dirName) => {
        const dirPath = path.resolve(config.dirPath, dirName);
        if (!fs.lstatSync(dirPath).isDirectory()) return false;
        return fs.readdirSync(dirPath).some((fileName) => fileName.endsWith('.py'));
      });
      if (dirNames.length > 0) {
        jsonObj.scripts['format-code'] = `poetry run black ${dirNames.join(' ')}`;
        jsonObj.scripts.lint = `poetry run flake8 ${dirNames.join(' ')}`;
        jsonObj.scripts['lint-fix'] = 'yarn lint';
        jsonObj.scripts.format += ` && yarn format-code`;
      }
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
    if (config.root && config.containingYarnrcYml) {
      spawnSync('yarn', ['set', 'version', 'berry'], config.dirPath);
    }
    const workspaceOption = config.containingSubPackageJsons && !config.containingYarnrcYml ? ['-W'] : [];
    if (dependencies.length && dependencies.some((dep) => !jsonObj.dependencies?.[dep])) {
      spawnSync('yarn', ['add', ...workspaceOption, ...new Set(dependencies)], config.dirPath);
      yarnInstallRequired = false;
    }
    if (devDependencies.length && devDependencies.some((dep) => !jsonObj.devDependencies?.[dep])) {
      spawnSync('yarn', ['add', ...workspaceOption, '-D', ...new Set(devDependencies)], config.dirPath);
      yarnInstallRequired = false;
    }
    if (devDependencies.length && eslintPluginPrettierRemoved) {
      const params = config.containingYarnrcYml ? ['up'] : ['upgrade', '--latest'];
      spawnSync('yarn', [...params, ...new Set(devDependencies)], config.dirPath);
      yarnInstallRequired = false;
    }
  }
  return yarnInstallRequired;
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
    .map((line) => {
      const newLine = line.trim();
      return newLine.endsWith('/') ? newLine.slice(0, -1) : newLine;
    })
    .filter((l) => l && !l.startsWith('#') && !l.includes('/'));

  return lines.map((line) => ` "!**/${line}/**"`).join('');
}
