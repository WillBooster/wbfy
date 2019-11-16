import path from 'path';
import child_process from 'child_process';
import fs from 'fs-extra';
import merge from 'deepmerge';
import { PackageConfig } from '../types/packageConfig';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';

const scriptsWithoutLerna = {
  format: 'yarn prettier && yarn sort-package-json && yarn lint-fix',
  lint: 'eslint . --ext .js,.jsx,.ts,.tsx',
  'lint-fix': 'yarn lint --fix',
  prettier: 'prettier --write "**/{.*/,}*.{css,htm,html,js,json,jsx,md,scss,ts,tsx,yaml,yml}"',
  'sort-package-json': 'sort-package-json',
  typecheck: 'tsc --noEmit',
};

const scriptsWithLerna = merge(
  { ...scriptsWithoutLerna },
  {
    bootstrap: 'yarn && yarn lerna bootstrap --use-workspaces',
    format: 'yarn prettier && yarn sort-all-package-json && yarn lint-fix',
    'sort-all-package-json': 'yarn sort-package-json && yarn lerna run sort-package-json',
    typecheck: 'yarn lerna run typecheck',
  }
);
delete scriptsWithLerna['sort-package-json'];

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
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
  ],
  '../../.eslintrc.json': [],
};

export async function generatePackageJson(config: PackageConfig, allConfigs: PackageConfig[]): Promise<void> {
  const filePath = path.resolve(config.dirPath, 'package.json');
  const jsonText = fs.readFileSync(filePath).toString();
  const jsonObj = JSON.parse(jsonText);
  jsonObj.scripts = jsonObj.scripts || {};
  jsonObj.dependencies = jsonObj.dependencies || {};
  jsonObj.devDependencies = jsonObj.devDependencies || {};
  jsonObj.prettier = '@willbooster/prettier-config';

  let dependencies = [] as string[];
  let devDependencies = [] as string[];

  if (!config.root || !config.containingPackages) {
    if (config.containingTypeScript) {
      dependencies.push('tslib');
    }
    if (config.containingJsxOrTsx) {
      dependencies.push('react', 'react-hot-loader', '@hot-loader/react-dom');
      jsonObj['alias'] = jsonObj['alias'] || {};
      jsonObj.alias['react-dom'] = '@hot-loader/react-dom';
    }
  }

  if (config.root) {
    devDependencies.push('husky', 'lint-staged', 'prettier', 'sort-package-json', '@willbooster/prettier-config');
    if (config.containingTypeScript) {
      devDependencies.push('typescript', '@willbooster/tsconfig');
    }

    if (config.containingPackages) {
      devDependencies.push('lerna');
      jsonObj.workspaces = ['packages/*'];
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

  jsonObj.scripts = merge(jsonObj.scripts, config.containingPackages ? scriptsWithLerna : scriptsWithoutLerna);
  jsonObj.scripts.prettier += generatePrettierSuffix(config.dirPath);

  if (!config.containingTypeScript) {
    delete jsonObj.scripts.typecheck;
  }

  if (!config.containingJavaScript && !config.containingTypeScript) {
    delete jsonObj.scripts.lint;
    delete jsonObj.scripts['lint-fix'];
    jsonObj.scripts.format = jsonObj.scripts.format.substring(0, jsonObj.scripts.format.lastIndexOf(' && '));
  }

  fs.outputFileSync(filePath, JSON.stringify(jsonObj));

  if (dependencies.length) {
    spawnSync('yarn', ['add', '-W', ...new Set(dependencies)], config.dirPath);
  }
  if (devDependencies.length) {
    spawnSync('yarn', ['add', '-W', '-D', ...new Set(devDependencies)], config.dirPath);
  }
}

function generatePrettierSuffix(dirPath: string): string {
  const filePath = path.resolve(dirPath, '.prettierignore');
  const existingContent = fs.readFileSync(filePath).toString();
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

function spawnSync(command: string, args: string[], cwd: string): void {
  console.log(`$ ${command} at ${cwd}`);
  child_process.spawnSync(command, args, { cwd, shell: true, stdio: 'inherit' });
}
