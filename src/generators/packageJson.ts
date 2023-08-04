import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import { globby } from 'globby';
import type { PackageJson, SetRequired } from 'type-fest';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { EslintUtil } from '../utils/eslintUtil.js';
import { extensions } from '../utils/extensions.js';
import { gitHubUtil } from '../utils/githubUtil.js';
import { ignoreFileUtil } from '../utils/ignoreFileUtil.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync } from '../utils/spawnUtil.js';
import { getSrcDirs } from '../utils/srcDirectories.js';
import { BLITZ_VERSION, NEXT_VERSION } from '../utils/versionConstants.js';

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
  '@willbooster/eslint-config-blitz-next': [
    '@willbooster/eslint-config-blitz-next',
    ...tsCommonDeps,
    ...reactCommonDeps,
  ],
  '../../.eslintrc.json': [],
};

export async function generatePackageJson(
  config: PackageConfig,
  rootConfig: PackageConfig,
  skipAddingDeps: boolean
): Promise<void> {
  return logger.functionIgnoringException('generatePackageJson', async () => {
    await core(config, rootConfig, skipAddingDeps);
  });
}

async function core(config: PackageConfig, rootConfig: PackageConfig, skipAddingDeps: boolean): Promise<void> {
  const filePath = path.resolve(config.dirPath, 'package.json');
  const jsonText = await fs.promises.readFile(filePath, 'utf8');
  const jsonObj = JSON.parse(jsonText) as PackageJson;
  jsonObj.scripts = jsonObj.scripts || {};
  jsonObj.dependencies = jsonObj.dependencies || {};
  jsonObj.devDependencies = jsonObj.devDependencies || {};
  jsonObj.peerDependencies = jsonObj.peerDependencies || {};

  await removeDeprecatedStuff(jsonObj as SetRequired<PackageJson, 'scripts' | 'dependencies' | 'devDependencies'>);

  if (jsonObj.name !== '@willbooster/prettier-config') {
    jsonObj.prettier = '@willbooster/prettier-config';
  }

  for (const [key, value] of Object.entries(jsonObj.scripts as Record<string, string>)) {
    // Fresh repo still requires 'yarn install'
    if (!value.includes('git clone')) {
      jsonObj.scripts[key] = value.replace(/yarn\s*&&\s*/, '').replace(/yarn\s*install\s*&&\s*/, '');
    }
  }

  jsonObj.scripts = merge(jsonObj.scripts, generateScripts(config));
  jsonObj.scripts.prettify += await generatePrettierSuffix(config.dirPath);

  let dependencies: string[] = [];
  let devDependencies = ['lint-staged', 'prettier', 'sort-package-json', '@willbooster/prettier-config'];
  const poetryDevDependencies: string[] = [];

  if (config.root) {
    // To install the latest pinst
    devDependencies.push('husky');
    if (config.publicRepo || config.referredByOtherRepo) {
      // https://typicode.github.io/husky/#/?id=install-1
      devDependencies.push('pinst');
      jsonObj.scripts['prepack'] = 'pinst --disable';
      jsonObj.scripts['postpack'] = 'pinst --enable';
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
      jsonObj.version = '0.0.0-semantically-released';
    }
    if (config.depending.playwrightTest) {
      // Since llm-toolbox requires @playwright/test in dependencies
      if (!jsonObj.dependencies['@playwright/test']) {
        devDependencies.push('@playwright/test');
        delete jsonObj.dependencies['@playwright/test'];
      }
      delete jsonObj.dependencies['playwright'];
      delete jsonObj.devDependencies['playwright'];
    }
    if (config.containingSubPackageJsons) {
      jsonObj.workspaces = ['packages/*'];
    } else {
      delete jsonObj.workspaces;
    }
  }
  if (config.depending.wb) {
    if (jsonObj.dependencies['@willbooster/shared-scripts'] || jsonObj.dependencies['@willbooster/wb']) {
      dependencies.push('@willbooster/wb');
    } else {
      devDependencies.push('@willbooster/wb');
    }
    for (const [key, value] of Object.entries(jsonObj.scripts as Record<string, string>)) {
      jsonObj.scripts[key] = value.replace(/wb\s+db/, 'wb prisma');
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
  if (!jsonObj.private && jsonObj.license !== 'UNLICENSED' && rootConfig.publicRepo) {
    jsonObj.publishConfig ??= {};
    jsonObj.publishConfig.access ??= 'public';
  }
  const [owner] = gitHubUtil.getOrgAndName(config.repository ?? '');
  if (owner === 'WillBooster' || owner === 'WillBoosterLab') {
    jsonObj.author = 'WillBooster Inc.';
  }
  if (!config.root && jsonObj.private && !jsonObj.main) {
    // Make VSCode possible to refactor code across subpackages.
    jsonObj.main = './src';
  }

  // Since `"resolutions": { "npm/chalk": "^4.1.2" },` causes "Invalid npm token"
  delete jsonObj.resolutions?.['npm/chalk'];

  if (!config.containingSubPackageJsons) {
    if (!config.containingJavaScript && !config.containingTypeScript) {
      delete jsonObj.scripts.lint;
      delete jsonObj.scripts['lint-fix'];
      jsonObj.scripts.cleanup = jsonObj.scripts.cleanup?.replace(' && yarn lint-fix', '');
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
      const pythonFiles = await globby('**/*.py', {
        cwd: config.dirPath,
        dot: true,
        gitignore: true,
        ignore: ['test-fixtures'],
      });
      const dirNameSet = new Set<string>();
      for (const pythonFile of pythonFiles) {
        const [first, second] = pythonFile.split(/[/\\]/);
        if (second) {
          dirNameSet.add(first);
        }
      }
      if (dirNameSet.size > 0) {
        const dirNamesStr = [...dirNameSet].join(' ');
        jsonObj.scripts[
          'format-code'
        ] = `poetry run isort --profile black ${dirNamesStr} && poetry run black ${dirNamesStr}`;
        if (jsonObj.scripts.lint) {
          jsonObj.scripts.lint = `poetry run flake8 ${dirNamesStr} && ${jsonObj.scripts.lint}`;
        } else {
          jsonObj.scripts.lint = `poetry run flake8 ${dirNamesStr}`;
          jsonObj.scripts['lint-fix'] = 'yarn lint';
        }
        jsonObj.scripts.format += ` && yarn format-code`;
        poetryDevDependencies.push('black', 'isort', 'flake8');
      }
    }

    if (config.repository) {
      jsonObj.repository = config.repository;
    }
  }

  if (config.depending.blitz) {
    dependencies.push(
      `@blitzjs/auth@${BLITZ_VERSION}`,
      `@blitzjs/next@${BLITZ_VERSION}`,
      `@blitzjs/rpc@${BLITZ_VERSION}`,
      `next@${NEXT_VERSION}`
    );
    // Prefer eslint-config-next's dependencies
    devDependencies = devDependencies.filter((d) => d !== 'eslint-plugin-react' && d !== 'eslint-plugin-react-hooks');
    if (!jsonObj.scripts['gen-code']?.startsWith('blitz codegen')) {
      jsonObj.scripts['gen-code'] = 'blitz codegen';
    } else if (!jsonObj.scripts['gen-code'].includes('blitz prisma generate')) {
      jsonObj.scripts['gen-code'] = jsonObj.scripts['gen-code'].replace(
        'blitz codegen',
        'blitz codegen && blitz prisma generate'
      );
    }
  } else if (config.depending.prisma && !jsonObj.scripts['gen-code']?.startsWith('prisma generate')) {
    jsonObj.scripts['gen-code'] = 'prisma generate';
  }

  if (config.depending.next) {
    // To prevent multiple versions of @types/react from mixing.
    delete jsonObj.devDependencies['@types/react'];
  }

  if (Object.keys(jsonObj.dependencies).length === 0) {
    delete jsonObj.dependencies;
  }
  if (Object.keys(jsonObj.devDependencies).length === 0) {
    delete jsonObj.devDependencies;
  }
  if (Object.keys(jsonObj.peerDependencies).length === 0) {
    delete jsonObj.peerDependencies;
  }

  let newJsonText = JSON.stringify(jsonObj);
  newJsonText = await fixScriptNames(jsonObj.scripts, newJsonText, config);
  await fs.promises.writeFile(filePath, newJsonText);

  if (!skipAddingDeps) {
    // We cannot add dependencies which are already included in devDependencies.
    dependencies = dependencies.filter((dep) => !jsonObj.devDependencies?.[dep]);
    if (dependencies.length > 0) {
      spawnSync('yarn', ['add', ...new Set(dependencies)], config.dirPath);
    }
    // We cannot add devDependencies which are already included in dependencies.
    devDependencies = devDependencies.filter((dep) => !jsonObj.dependencies?.[dep]);
    if (devDependencies.length > 0) {
      spawnSync('yarn', ['add', '-D', ...new Set(devDependencies)], config.dirPath);
    }
    if (poetryDevDependencies.length > 0) {
      spawnSync('poetry', ['add', '--group', 'dev', ...new Set(poetryDevDependencies)], config.dirPath);
    }
  }
}

// TODO: remove the following migration code in future
async function removeDeprecatedStuff(
  jsonObj: SetRequired<PackageJson, 'scripts' | 'dependencies' | 'devDependencies'>
): Promise<void> {
  if (jsonObj.author === 'WillBooster LLC') {
    jsonObj.author = 'WillBooster Inc.';
  }
  delete jsonObj.scripts['sort-package-json'];
  delete jsonObj.scripts['sort-all-package-json'];
  delete jsonObj.scripts['typecheck/warn'];
  delete jsonObj.scripts['typecheck:gen-code'];
  delete jsonObj.scripts['typecheck:codegen'];
  delete jsonObj.dependencies['@willbooster/shared-scripts'];
  delete jsonObj.dependencies['tslib'];
  delete jsonObj.devDependencies['@willbooster/eslint-config'];
  delete jsonObj.devDependencies['@willbooster/eslint-config-react'];
  delete jsonObj.devDependencies['@willbooster/renovate-config'];
  delete jsonObj.devDependencies['@willbooster/shared-scripts'];
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

export function generateScripts(config: PackageConfig): Record<string, string> {
  let scripts: Record<string, string> = {
    cleanup: 'yarn format && yarn lint-fix',
    format: `sort-package-json && yarn prettify`,
    lint: `eslint --color "./{${getSrcDirs(config)}}/**/*.{${extensions.eslint.join(',')}}"`,
    'lint-fix': 'yarn lint --fix',
    prettify: `prettier --cache --color --write "**/{.*/,}*.{${extensions.prettier.join(',')}}" "!**/test-fixtures/**"`,
    typecheck: 'tsc --noEmit --Pretty',
  };
  if (config.containingSubPackageJsons) {
    scripts = merge(
      { ...scripts },
      {
        format: `sort-package-json && yarn prettify && yarn workspaces foreach --parallel --verbose run format`,
        lint: `yarn workspaces foreach --parallel --verbose run lint`,
        'lint-fix': 'yarn workspaces foreach --parallel --verbose run lint-fix',
        prettify: `prettier --cache --color --write "**/{.*/,}*.{${extensions.prettier.join(
          ','
        )}}" "!**/packages/**" "!**/test-fixtures/**"`,
        // CI=1 prevents vitest from enabling watch.
        // FORCE_COLOR=3 make wb enable color output.
        test: 'CI=1 FORCE_COLOR=3 yarn workspaces foreach --verbose run test',
        typecheck: 'yarn workspaces foreach --parallel --verbose run typecheck',
      }
    );
    if (!config.containingTypeScript && !config.containingTypeScriptInPackages) {
      delete scripts.typecheck;
    }
  } else {
    if (config.depending.wb) {
      scripts.typecheck = 'wb typecheck';
    }
    if (!config.containingTypeScript && !config.containingTypeScriptInPackages) {
      delete scripts.typecheck;
    }
    if (config.depending.pyright) {
      scripts.typecheck = scripts.typecheck ? `${scripts.typecheck} && ` : '';
      scripts.typecheck += 'pyright';
    }
  }
  return scripts;
}

async function generatePrettierSuffix(dirPath: string): Promise<string> {
  const filePath = path.resolve(dirPath, '.prettierignore');
  const existingContent = await fs.promises.readFile(filePath, 'utf8');
  const index = existingContent.indexOf(ignoreFileUtil.separatorPrefix);
  if (index < 0) return '';

  const originalContent = existingContent.slice(0, index);
  const lines = originalContent
    .split('\n')
    .map((line) => {
      const newLine = line.trim();
      return newLine.endsWith('/') ? newLine.slice(0, -1) : newLine;
    })
    .filter((l) => l && !l.startsWith('#') && !l.includes('/'));

  return lines.map((line) => ` "!**/${line}/**"`).join('');
}

async function fixScriptNames(
  scripts: PackageJson.Scripts,
  newJsonText: string,
  config: PackageConfig
): Promise<string> {
  const oldAndNewScriptNames: [string, string][] = [];
  for (const [key] of Object.keys(scripts)) {
    if (key[0] !== ':' && key.includes(':')) {
      oldAndNewScriptNames.push([key, key.replaceAll(':', '-')]);
    }
  }
  if (oldAndNewScriptNames.length === 0) return newJsonText;

  for (const [oldName, newName] of oldAndNewScriptNames) {
    newJsonText = newJsonText.replaceAll(oldName, newName);
  }
  const files = await globby(['**/*.{md,cjs,mjs,js,jsx,cts,mts,ts,tsx}', '**/Dockerfile'], {
    cwd: config.dirPath,
    dot: true,
    gitignore: true,
  });
  for (const file of files) {
    await promisePool.run(async () => {
      const filePath = path.join(config.dirPath, file);
      const oldContent = await fs.promises.readFile(filePath, 'utf8');
      let newContent = oldContent;
      for (const [oldName, newName] of oldAndNewScriptNames) {
        newContent = newContent.replaceAll(oldName, newName);
      }
      if (newContent !== oldContent) {
        await fs.promises.writeFile(filePath, newContent);
      }
    });
  }
  await promisePool.promiseAll();
  return newJsonText;
}
