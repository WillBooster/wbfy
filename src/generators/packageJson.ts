import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import { globby, globbySync } from 'globby';
import type { PackageJson, SetRequired } from 'type-fest';

import { getLatestCommitHash } from '../github/commit.js';
import { logger } from '../logger.js';
import type { EslintExtensionBase, PackageConfig } from '../packageConfig.js';
import { EslintUtil } from '../utils/eslintUtil.js';
import { extensions } from '../utils/extensions.js';
import { gitHubUtil } from '../utils/githubUtil.js';
import { ignoreFileUtil } from '../utils/ignoreFileUtil.js';
import { combineMerge } from '../utils/mergeUtil.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync } from '../utils/spawnUtil.js';
import { getSrcDirs } from '../utils/srcDirectories.js';
import { BLITZ_VERSION, NEXT_VERSION } from '../utils/versionConstants.js';

const jsCommonDeps = [
  'eslint@8.57.0',
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

const eslintDeps: Record<EslintExtensionBase, string[]> = {
  '@willbooster/eslint-config-js': ['@willbooster/eslint-config-js', ...jsCommonDeps],
  '@willbooster/eslint-config-js-react': ['@willbooster/eslint-config-js-react', ...jsCommonDeps, ...reactCommonDeps],
  '@willbooster/eslint-config-ts': ['@willbooster/eslint-config-ts', ...tsCommonDeps],
  '@willbooster/eslint-config-ts-react': ['@willbooster/eslint-config-ts-react', ...tsCommonDeps, ...reactCommonDeps],
  '@willbooster/eslint-config-blitz-next': [
    '@willbooster/eslint-config-blitz-next',
    'eslint-config-next',
    ...tsCommonDeps,
    ...reactCommonDeps,
  ],
  '@willbooster/eslint-config-next': [
    '@willbooster/eslint-config-next',
    'eslint-config-next',
    ...tsCommonDeps,
    ...reactCommonDeps,
  ],
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

  await removeDeprecatedStuff(
    rootConfig,
    jsonObj as SetRequired<PackageJson, 'scripts' | 'dependencies' | 'devDependencies'>
  );

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
  if (config.isBun) {
    delete jsonObj.scripts.prettify;
  } else {
    jsonObj.scripts.prettify += await generatePrettierSuffix(config.dirPath);
  }
  // Deal with breaking changes in yarn berry 4.0.0-rc.49
  for (const [key, value] of Object.entries(jsonObj.scripts)) {
    if (!value?.includes('yarn workspaces foreach')) continue;
    if (
      value.includes('--all') ||
      value.includes('--recursive') ||
      value.includes('--since') ||
      value.includes('--worktree')
    )
      continue;
    jsonObj.scripts[key] = value.replace('yarn workspaces foreach', 'yarn workspaces foreach --all');
  }

  let dependencies: string[] = [];
  let devDependencies = ['prettier', 'sort-package-json', '@willbooster/prettier-config'];
  const poetryDevDependencies: string[] = [];

  if (config.isBun) {
    delete jsonObj.devDependencies['lint-staged'];
  } else {
    devDependencies.push('lint-staged');
  }

  if (config.isRoot) {
    if (config.isBun) {
      delete jsonObj.devDependencies['husky'];
      delete jsonObj.devDependencies['pinst'];
      jsonObj.scripts.prepare = 'lefthook install || true';
    } else {
      // To install the latest husky
      devDependencies.push('husky');
      // '|| true' avoids errors when husky is not installed.
      jsonObj.scripts.prepare = 'husky || true'; // for non-yarn package managers.
      jsonObj.scripts.postinstall = 'husky || true'; // for yarn.
      if (config.isPublicRepo || config.isReferredByOtherRepo) {
        // To install the latest pinst
        // https://typicode.github.io/husky/#/?id=install-1
        devDependencies.push('pinst');
        jsonObj.scripts.prepack = 'pinst --disable';
        jsonObj.scripts.postpack = 'pinst --enable';
      }
    }
    if (config.depending.semanticRelease) {
      const version =
        jsonObj.devDependencies['multi-semantic-release'] || jsonObj.devDependencies['@qiwi/multi-semantic-release']
          ? // TODO: remove the version specification after multi-semantic-release supports version 7+
            '@6.1.0'
          : '';
      devDependencies.push(`conventional-changelog-conventionalcommits${version}`);
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
    if (config.doesContainsSubPackageJsons) {
      // We don't allow non-array workspaces in monorepo.
      jsonObj.workspaces = Array.isArray(jsonObj.workspaces)
        ? merge.all([jsonObj.workspaces, ['packages/*']], {
            arrayMerge: combineMerge,
          })
        : ['packages/*'];
    } else if (Array.isArray(jsonObj.workspaces)) {
      jsonObj.workspaces = jsonObj.workspaces.filter(
        (workspace) =>
          globbySync(workspace, {
            dot: true,
            cwd: config.dirPath,
            gitignore: true,
          }).length > 0
      );
      if (jsonObj.workspaces.length === 0) {
        delete jsonObj.workspaces;
      }
    }
  }
  if (config.depending.wb || config.isBun) {
    if (jsonObj.dependencies['@willbooster/wb']) {
      dependencies.push('@willbooster/wb');
    } else {
      devDependencies.push('@willbooster/wb');
    }
    for (const [key, value] of Object.entries(jsonObj.scripts as Record<string, string>)) {
      jsonObj.scripts[key] = value.replace(/wb\s+db/, 'wb prisma');
    }
  }

  if (
    config.doesContainsJavaScript ||
    config.doesContainsJavaScriptInPackages ||
    config.doesContainsTypeScript ||
    config.doesContainsTypeScriptInPackages
  ) {
    if (config.isBun) {
      devDependencies.push('@biomejs/biome', '@willbooster/biome-config');
      delete jsonObj.devDependencies['eslint'];
      delete jsonObj.devDependencies['micromatch'];
      delete jsonObj.devDependencies['@typescript-eslint/parser'];
    } else {
      devDependencies.push('eslint@8.57.0', 'micromatch');
      // TODO: not needed anymore?
      if (config.doesContainsTypeScriptInPackages) {
        devDependencies.push('@typescript-eslint/parser');
      }
    }
  }

  if (config.doesContainsTypeScript || config.doesContainsTypeScriptInPackages) {
    devDependencies.push('typescript');
    if (config.isBun) {
      devDependencies.push('@types/bun');
    }
  }

  if (config.eslintBase) {
    devDependencies.push(...eslintDeps[config.eslintBase]);
  }

  if (config.isWillBoosterConfigs) {
    dependencies = dependencies.filter((dep) => !dep.includes('@willbooster/'));
    devDependencies = devDependencies.filter((dep) => !dep.includes('@willbooster/'));
  }

  if (!jsonObj.name) {
    jsonObj.name = path.basename(config.dirPath);
  }

  if (config.doesContainsSubPackageJsons) {
    jsonObj.private = true;
  }
  if (!jsonObj.license) {
    jsonObj.license = 'UNLICENSED';
  }
  if (!jsonObj.private && jsonObj.license !== 'UNLICENSED' && rootConfig.isPublicRepo) {
    jsonObj.publishConfig ??= {};
    jsonObj.publishConfig.access ??= 'public';
  }
  const [owner] = gitHubUtil.getOrgAndName(config.repository ?? '');
  if (owner === 'WillBooster' || owner === 'WillBoosterLab') {
    jsonObj.author = 'WillBooster Inc.';
  }
  if (!config.isRoot && jsonObj.private && !jsonObj.main) {
    // Make VSCode possible to refactor code across subpackages.
    jsonObj.main = './src';
  }

  // Because `"resolutions": { "npm/chalk": "^4.1.2" },` causes "Invalid npm token"
  delete jsonObj.resolutions?.['npm/chalk'];

  if (!config.doesContainsSubPackageJsons) {
    if (!config.isBun) {
      if (!config.doesContainsJavaScript && !config.doesContainsTypeScript) {
        delete jsonObj.scripts.lint;
        delete jsonObj.scripts['lint-fix'];
        jsonObj.scripts.cleanup = jsonObj.scripts.cleanup?.replace(' && yarn lint-fix', '');
      } else {
        jsonObj.scripts['lint-fix'] += EslintUtil.getLintFixSuffix(config);
      }
    }

    if (config.doesContainsPubspecYaml) {
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

    if (config.doesContainsPoetryLock) {
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
        jsonObj.scripts['format-code'] =
          `poetry run isort --profile black ${dirNamesStr} && poetry run black ${dirNamesStr}`;
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
      `blitz@${BLITZ_VERSION}`,
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

  if (!jsonObj.dependencies?.prettier) {
    // Because @types/prettier blocks prettier execution.
    delete jsonObj.devDependencies['@types/prettier'];
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

  await updatePrivatePackages(jsonObj);

  if (config.isBun) delete jsonObj.packageManager;
  let newJsonText = JSON.stringify(jsonObj);
  newJsonText = await fixScriptNames(jsonObj.scripts, newJsonText, config);
  await fs.promises.writeFile(filePath, newJsonText);

  if (!skipAddingDeps) {
    // We cannot add dependencies which are already included in devDependencies.
    dependencies = dependencies.filter((dep) => !jsonObj.devDependencies?.[dep]);
    const packageManager = config.isBun ? 'bun' : 'yarn';
    if (dependencies.length > 0) {
      spawnSync(packageManager, ['add', ...new Set(dependencies)], config.dirPath);
    }
    // We cannot add devDependencies which are already included in dependencies.
    devDependencies = devDependencies.filter((dep) => !jsonObj.dependencies?.[dep]);
    if (devDependencies.length > 0) {
      spawnSync(packageManager, ['add', '-D', ...new Set(devDependencies)], config.dirPath);
    }
    if (poetryDevDependencies.length > 0) {
      spawnSync('poetry', ['add', '--group', 'dev', ...new Set(poetryDevDependencies)], config.dirPath);
    }
  }
}

// TODO: remove the following migration code in future
async function removeDeprecatedStuff(
  rootConfig: PackageConfig,
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
  delete jsonObj.dependencies['tslib'];
  delete jsonObj.devDependencies['@willbooster/eslint-config'];
  delete jsonObj.devDependencies['@willbooster/eslint-config-react'];
  delete jsonObj.devDependencies['@willbooster/renovate-config'];
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
  if (!rootConfig.isWillBoosterConfigs) {
    for (const deps of Object.values(eslintDeps)) {
      for (const dep of deps) {
        delete jsonObj.devDependencies[dep];
      }
    }
  }
  await promisePool.run(() => fs.promises.rm('lerna.json', { force: true }));
}

export function generateScripts(config: PackageConfig): Record<string, string> {
  if (config.isBun) {
    const scripts: Record<string, string> = {
      cleanup: 'bun --bun wb lint --fix --format',
      format: `bun --bun wb lint --format`,
      lint: `bun --bun wb lint`,
      'lint-fix': 'bun --bun wb lint --fix',
      test: 'bun wb test',
      typecheck: 'bun --bun wb typecheck',
    };
    if (!config.doesContainsTypeScript && !config.doesContainsTypeScriptInPackages) {
      delete scripts.typecheck;
    }
    return scripts;
  } else {
    let scripts: Record<string, string> = {
      cleanup: 'yarn format && yarn lint-fix',
      format: `sort-package-json && yarn prettify`,
      lint: `eslint --color "./{${getSrcDirs(config)}}/**/*.{${extensions.eslint.join(',')}}"`,
      'lint-fix': 'yarn lint --fix',
      prettify: `prettier --cache --color --write "**/{.*/,}*.{${extensions.prettier.join(',')}}" "!**/test-fixtures/**"`,
      typecheck: 'tsc --noEmit --Pretty',
    };
    if (config.doesContainsSubPackageJsons) {
      const oldTest = scripts.test;
      scripts = merge(
        { ...scripts },
        {
          format: `sort-package-json && yarn prettify && yarn workspaces foreach --all --parallel --verbose run format`,
          lint: `yarn workspaces foreach --all --parallel --verbose run lint`,
          'lint-fix': 'yarn workspaces foreach --all --parallel --verbose run lint-fix',
          prettify: `prettier --cache --color --write "**/{.*/,}*.{${extensions.prettier.join(
            ','
          )}}" "!**/packages/**" "!**/test-fixtures/**"`,
          // CI=1 prevents vitest from enabling watch.
          // FORCE_COLOR=3 make wb enable color output.
          test: 'CI=1 FORCE_COLOR=3 yarn workspaces foreach --all --verbose run test',
          typecheck: 'yarn workspaces foreach --all --parallel --verbose run typecheck',
        }
      );
      if (oldTest?.includes('wb test')) {
        scripts.test = oldTest;
      }
    } else if (config.depending.pyright) {
      scripts.typecheck = scripts.typecheck ? `${scripts.typecheck} && ` : '';
      scripts.typecheck += 'pyright';
    }

    if (!config.doesContainsTypeScript && !config.doesContainsTypeScriptInPackages) {
      delete scripts.typecheck;
    } else if (config.depending.wb) {
      scripts.typecheck = 'wb typecheck';
    }
    return scripts;
  }
}

async function generatePrettierSuffix(dirPath: string): Promise<string> {
  const filePath = path.resolve(dirPath, '.prettierignore');
  const existingContent = await fs.promises.readFile(filePath, 'utf8');
  const index = existingContent.indexOf(ignoreFileUtil.separatorPrefix);
  if (index === -1) return '';

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

async function updatePrivatePackages(jsonObj: PackageJson): Promise<void> {
  jsonObj.dependencies = jsonObj.dependencies || {};
  jsonObj.devDependencies = jsonObj.devDependencies || {};
  const packageNames = new Set([...Object.keys(jsonObj.dependencies), ...Object.keys(jsonObj.devDependencies)]);
  if (packageNames.has('@willbooster/auth')) {
    delete jsonObj.devDependencies['@willbooster/auth'];
    const commitHash = await getLatestCommitHash('WillBoosterLab', 'auth');
    jsonObj.dependencies['@willbooster/auth'] = `git@github.com:WillBoosterLab/auth.git#${commitHash}`;
  }
  if (packageNames.has('@discord-bot/shared')) {
    delete jsonObj.devDependencies['@discord-bot/shared'];
    const commitHash = await getLatestCommitHash('WillBoosterLab', 'discord-bot');
    jsonObj.dependencies['@discord-bot/shared'] = `git@github.com:WillBoosterLab/discord-bot.git#${commitHash}`;
  }

  if (packageNames.has('@willbooster/code-analyzer')) {
    delete jsonObj.dependencies['@willbooster/code-analyzer'];
    const commitHash = await getLatestCommitHash('WillBoosterLab', 'code-analyzer');
    jsonObj.devDependencies['@willbooster/code-analyzer'] =
      `git@github.com:WillBoosterLab/code-analyzer.git#workspace=@code-analyzer/client&commit=${commitHash}`;
  }
  if (packageNames.has('@willbooster/judge')) {
    delete jsonObj.dependencies['@willbooster/judge'];
    const commitHash = await getLatestCommitHash('WillBoosterLab', 'judge');
    jsonObj.devDependencies['@willbooster/judge'] = `git@github.com:WillBoosterLab/judge.git#${commitHash}`;
  }
  if (packageNames.has('@willbooster/llm-proxy')) {
    delete jsonObj.dependencies['@willbooster/llm-proxy'];
    const commitHash = await getLatestCommitHash('WillBoosterLab', 'llm-proxy');
    jsonObj.devDependencies['@willbooster/llm-proxy'] =
      `git@github.com:WillBoosterLab/llm-proxy.git#workspace=@llm-proxy/client&commit=${commitHash}`;
  }
}
