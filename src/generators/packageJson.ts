import fs from 'fs';
import path from 'path';

import merge from 'deepmerge';

import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { EslintUtil } from '../utils/eslintUtil';
import { extensions } from '../utils/extensions';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { promisePool } from '../utils/promisePool';
import { spawnSync } from '../utils/spawnUtil';
import { getSrcDirs } from '../utils/srcDirectories';

const jsCommonDeps = [
  'eslint',
  'eslint-config-prettier',
  'eslint-plugin-import',
  'eslint-plugin-sort-class-members',
  'eslint-plugin-sort-destructure-keys',
  'eslint-plugin-unicorn',
];

const tsCommonDeps = [
  ...jsCommonDeps,
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'eslint-import-resolver-typescript',
];

const reactCommonDeps = ['eslint-plugin-react', 'eslint-plugin-react-hooks'];

const devDeps: { [prop: string]: string[] } = {
  '@willbooster/eslint-config-js': ['@willbooster/eslint-config-js', ...jsCommonDeps],
  '@willbooster/eslint-config-js-react': ['@willbooster/eslint-config-js-react', ...jsCommonDeps, ...reactCommonDeps],
  '@willbooster/eslint-config-ts': ['@willbooster/eslint-config-ts', ...tsCommonDeps],
  '@willbooster/eslint-config-ts-react': ['@willbooster/eslint-config-ts-react', ...tsCommonDeps, ...reactCommonDeps],
  '../../.eslintrc.json': [],
};

export async function generatePackageJson(
  config: PackageConfig,
  rootConfig: PackageConfig,
  skipAddingDeps: boolean
): Promise<void> {
  return logger.function('generatePackageJson', async () => {
    await core(config, rootConfig, skipAddingDeps);
  });
}

async function core(config: PackageConfig, rootConfig: PackageConfig, skipAddingDeps: boolean): Promise<void> {
  const filePath = path.resolve(config.dirPath, 'package.json');
  const jsonText = await fs.promises.readFile(filePath, 'utf-8');
  const jsonObj = JSON.parse(jsonText);
  jsonObj.scripts = jsonObj.scripts || {};
  jsonObj.dependencies = jsonObj.dependencies || {};
  jsonObj.devDependencies = jsonObj.devDependencies || {};
  jsonObj.peerDependencies = jsonObj.peerDependencies || {};

  await removeDeprecatedStuff(jsonObj);

  if (jsonObj.name !== '@willbooster/prettier-config') {
    jsonObj.prettier = '@willbooster/prettier-config';
  }

  for (const scriptKey of Object.keys(jsonObj.scripts)) {
    // Fresh repo still requires 'yarn install'
    if (!jsonObj.scripts[scriptKey].includes('git clone')) {
      jsonObj.scripts[scriptKey] = jsonObj.scripts[scriptKey]
        .replace(/yarn\s*&&\s*/, '')
        .replace(/yarn\s*install\s*&&\s*/, '');
    }
  }

  jsonObj.scripts = merge(jsonObj.scripts, generateScripts(config));
  jsonObj.scripts.prettify += await generatePrettierSuffix(config.dirPath);

  let dependencies: string[] = [];
  let devDependencies = ['lint-staged', 'prettier', 'sort-package-json', '@willbooster/prettier-config'];
  const poetryDependencies: string[] = [];

  if (config.root) {
    // To install the latest pinst
    devDependencies.push('husky', '@willbooster/renovate-config');
    if (config.publicRepo) {
      devDependencies.push('pinst');
    }
    if (config.depending.semanticRelease) {
      devDependencies.push('conventional-changelog-conventionalcommits');
      if (
        !jsonObj.devDependencies['semantic-release'] &&
        !jsonObj.devDependencies['multi-semantic-release'] &&
        !jsonObj.devDependencies['@qiwi/multi-semantic-release']
      ) {
        devDependencies.push('semantic-release');
      }
    }
    if (config.containingSubPackageJsons) {
      jsonObj.workspaces = ['packages/*'];
    } else {
      delete jsonObj.workspaces;
    }
  }

  if (
    config.containingJavaScript ||
    config.containingJavaScriptInPackages ||
    config.containingTypeScript ||
    config.containingTypeScriptInPackages
  ) {
    devDependencies.push('eslint', 'micromatch');
    // TODO: not needed anymore?
    if (config.containingTypeScriptInPackages) {
      devDependencies.push('@typescript-eslint/parser');
    }
  }

  if ((config.containingTypeScript || config.containingTypeScriptInPackages) && !config.depending.blitz) {
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
  if (!jsonObj.private && jsonObj.license !== 'UNLICENSED' && rootConfig.publicRepo) {
    jsonObj.publishConfig ??= {};
    jsonObj.publishConfig.access ??= 'public';
  }

  if (!config.containingTypeScript && !config.containingTypeScriptInPackages) {
    delete jsonObj.scripts.typecheck;
  }

  // https://github.com/semantic-release/semantic-release/issues/2323#issuecomment-1032341621
  if (config.depending.semanticRelease && config.release.npm) {
    jsonObj.resolutions ||= {};
    jsonObj.resolutions['npm/chalk'] = '^4.1.2';
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
      if (jsonObj.scripts.postinstall === 'poetry install') {
        delete jsonObj.scripts.postinstall;
      }
      const dirNames = (await fs.promises.readdir(config.dirPath)).filter((dirName) => {
        const dirPath = path.resolve(config.dirPath, dirName);
        if (!fs.lstatSync(dirPath).isDirectory()) return false;
        return fs.readdirSync(dirPath).some((fileName) => fileName.endsWith('.py'));
      });
      if (dirNames.length > 0) {
        jsonObj.scripts['format-code'] = `poetry run isort --profile black ${dirNames.join(
          ' '
        )} && poetry run black ${dirNames.join(' ')}`;
        jsonObj.scripts.lint = `poetry run flake8 ${dirNames.join(' ')}`;
        jsonObj.scripts['lint-fix'] = 'yarn lint';
        jsonObj.scripts.format += ` && yarn format-code`;
        poetryDependencies.push('black', 'isort', 'flake8');
      }
    }

    if (config.repository) {
      jsonObj.repository = config.repository;
    }
  }

  if (config.depending.blitz) {
    // These cause an error of eslint-plugin-import loading
    devDependencies = devDependencies.filter((dep) => !dep.includes('@typescript-eslint/'));
    // This causes eslint errors
    devDependencies = devDependencies.filter(
      (d) =>
        d !== 'eslint-plugin-react' &&
        d !== 'eslint-import-resolver-typescript' &&
        d !== 'eslint-plugin-import' &&
        d !== 'eslint-plugin-react-hooks'
    );
    if (!jsonObj.scripts['gen-code']?.startsWith('blitz codegen')) {
      jsonObj.scripts['gen-code'] = 'blitz codegen';
    }
  } else if (config.depending.prisma) {
    if (!jsonObj.scripts['gen-code']?.startsWith('prisma generate')) {
      jsonObj.scripts['gen-code'] = 'prisma generate';
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

  await fs.promises.writeFile(filePath, JSON.stringify(jsonObj));

  if (!skipAddingDeps) {
    dependencies = dependencies.filter((dep) => !jsonObj.devDependencies?.[dep]);
    if (dependencies.length) {
      spawnSync('yarn', ['add', ...new Set(dependencies)], config.dirPath);
    }
    devDependencies = devDependencies.filter((dep) => !jsonObj.dependencies?.[dep]);
    if (devDependencies.length) {
      spawnSync('yarn', ['add', '-D', ...new Set(devDependencies)], config.dirPath);
    }
    if (poetryDependencies.length) {
      spawnSync('poetry', ['add', ...new Set(poetryDependencies)], config.dirPath);
    }
  }
}

async function removeDeprecatedStuff(jsonObj: any): Promise<void> {
  // TODO: remove the following migration code in future
  if (jsonObj.author === 'WillBooster LLC') {
    jsonObj.author = 'WillBooster Inc.';
  }
  delete jsonObj.scripts['sort-package-json'];
  delete jsonObj.scripts['sort-all-package-json'];
  delete jsonObj.scripts['typecheck:codegen'];
  delete jsonObj.dependencies['tslib'];
  delete jsonObj.devDependencies['@willbooster/eslint-config'];
  delete jsonObj.devDependencies['@willbooster/eslint-config-react'];
  delete jsonObj.devDependencies['@willbooster/tsconfig'];
  delete jsonObj.devDependencies['eslint-import-resolver-node'];
  delete jsonObj.devDependencies['eslint-plugin-prettier'];
  delete jsonObj.devDependencies['lerna'];
  // To install the latest pinst
  delete jsonObj.devDependencies['pinst'];
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
  await promisePool.run(() => fs.promises.rm('lerna.json', { force: true }));
}

function generateScripts(config: PackageConfig): Record<string, string> {
  let scripts = {
    cleanup: 'yarn format && yarn lint-fix',
    format: `sort-package-json && yarn prettify`,
    lint: `eslint --color "./{${getSrcDirs(config)}}/**/*.{${extensions.eslint.join(',')}}"`,
    'lint-fix': 'yarn lint --fix',
    prettify: `prettier --color --write "**/{.*/,}*.{${extensions.prettier.join(',')}}" "!**/test-fixtures/**"`,
    typecheck: 'tsc --noEmit --Pretty',
  };
  if (config.containingSubPackageJsons) {
    scripts = merge(
      { ...scripts },
      {
        format: `sort-package-json && yarn prettify && yarn workspaces foreach --parallel --verbose run format`,
        lint: `yarn workspaces foreach --parallel --verbose run lint`,
        'lint-fix': 'yarn workspaces foreach --parallel --verbose run lint-fix',
        prettify: `prettier --color --write "**/{.*/,}*.{${extensions.prettier.join(
          ','
        )}}" "!**/packages/**" "!**/test-fixtures/**"`,
        test: 'yarn workspaces foreach --verbose run test',
        typecheck: 'yarn workspaces foreach --parallel --verbose run typecheck',
      }
    );
  }
  if (config.depending.blitz) {
    scripts.typecheck = `${scripts.typecheck} || yarn run typecheck/warn`;
    (scripts as any)['typecheck/warn'] = `echo 'Please try "yarn gen-code" if you face unknown type errors.' && exit 1`;
    (scripts as any)['typecheck:gen-code'] = 'yarn gen-code && tsc --noEmit --Pretty';
  }
  return scripts;
}

async function generatePrettierSuffix(dirPath: string): Promise<string> {
  const filePath = path.resolve(dirPath, '.prettierignore');
  const existingContent = await fs.promises.readFile(filePath, 'utf-8');
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
