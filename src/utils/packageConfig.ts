import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import glob from 'glob';
import yaml from 'js-yaml';

export interface PackageConfig {
  dirPath: string;
  root: boolean;
  private: boolean;
  willBoosterConfigs: boolean;
  containingSubPackageJsons: boolean;
  containingGemfile: boolean;
  containingGoMod: boolean;
  containingPackageJson: boolean;
  containingPoetryLock: boolean;
  containingPomXml: boolean;
  containingPubspecYaml: boolean;
  containingTemplateYaml: boolean;

  containingJavaScript: boolean;
  containingTypeScript: boolean;
  containingJsxOrTsx: boolean;
  containingJavaScriptInPackages: boolean;
  containingTypeScriptInPackages: boolean;
  containingJsxOrTsxInPackages: boolean;
  depending: {
    blitz: boolean;
    firebase: boolean;
    jestPlaywrightPreset: boolean;
    prisma: boolean;
    reactNative: boolean;
    semanticRelease: boolean;
    storybook: boolean;
  };
  release: {
    branches: string[];
    github: boolean;
    npm: boolean;
  };
  eslintBase?: string;
  requiringNodeModules: boolean;
  versionsText?: string;
}

export async function getPackageConfig(dirPath: string): Promise<PackageConfig | null> {
  const packageJsonPath = path.resolve(dirPath, 'package.json');
  try {
    const containingPackageJson = fs.existsSync(packageJsonPath);
    let dependencies: { [key: string]: string } = {};
    let devDependencies: { [key: string]: string } = {};
    let packageJson: any = {};
    if (containingPackageJson) {
      const packageJsonText = fs.readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageJsonText);
      dependencies = packageJson.dependencies ?? {};
      devDependencies = packageJson.devDependencies ?? {};
    }

    let requiringNodeModules = true;
    try {
      const yarnrcYmlPath = path.resolve(dirPath, '.yarnrc.yml');
      const doc = yaml.load(await fsp.readFile(yarnrcYmlPath, 'utf8')) as any;
      requiringNodeModules = !doc.nodeLinker || doc.nodeLinker === 'node-modules';
    } catch (_) {
      // do nothing
    }

    let releaseBranches: string[] = [];
    let releasePlugins: string[] = [];
    try {
      const releasercJsonPath = path.resolve(dirPath, '.releaserc.json');
      const json = JSON.parse(await fsp.readFile(releasercJsonPath, 'utf8'));
      releaseBranches = json?.branches || [];
      releasePlugins = json?.plugins?.flat() || [];
    } catch (_) {
      // do nothing
    }

    const isPrivate =
      packageJson.private &&
      glob.sync('packages/**/package.json', { cwd: dirPath }).map((p) => {
        const packageJsonText = fs.readFileSync(path.join(dirPath, p), 'utf-8');
        return JSON.parse(packageJsonText).private;
      });

    const toolVersionsPath = path.resolve(dirPath, '.tool-versions');
    let versionsText: string | undefined;
    try {
      versionsText = await fsp.readFile(toolVersionsPath, 'utf-8');
    } catch (_) {
      // do nothing
    }

    const config: PackageConfig = {
      dirPath,
      root:
        path.basename(path.resolve(dirPath, '..')) !== 'packages' ||
        !fs.existsSync(path.resolve(dirPath, '..', '..', 'package.json')),
      private: !!isPrivate,
      willBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      containingSubPackageJsons: glob.sync('packages/**/package.json', { cwd: dirPath }).length > 0,
      containingGemfile: fs.existsSync(path.resolve(dirPath, 'Gemfile')),
      containingGoMod: fs.existsSync(path.resolve(dirPath, 'go.mod')),
      containingPackageJson: fs.existsSync(path.resolve(dirPath, 'package.json')),
      containingPoetryLock: fs.existsSync(path.resolve(dirPath, 'poetry.lock')),
      containingPomXml: fs.existsSync(path.resolve(dirPath, 'pom.xml')),
      containingPubspecYaml: fs.existsSync(path.resolve(dirPath, 'pubspec.yaml')),
      containingTemplateYaml: fs.existsSync(path.resolve(dirPath, 'template.yaml')),
      containingJavaScript: glob.sync('@(app|src|__tests__)/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScript: glob.sync('@(app|src|__tests__)/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsx: glob.sync('@(app|src|__tests__)/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      containingJavaScriptInPackages:
        glob.sync('packages/**/@(app|src|__tests__)/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScriptInPackages:
        glob.sync('packages/**/@(app|src|__tests__)/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsxInPackages:
        glob.sync('packages/**/@(app|src|__tests__)/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      depending: {
        blitz: !!(dependencies['blitz'] || devDependencies['blitz']),
        firebase: !!devDependencies['firebase-tools'],
        jestPlaywrightPreset: !!devDependencies['jest-playwright-preset'],
        prisma: !!devDependencies['prisma'],
        reactNative: !!dependencies['react-native'],
        semanticRelease: !!devDependencies['semantic-release'],
        storybook: !!devDependencies['@storybook/react'],
      },
      release: {
        branches: releaseBranches,
        github: releasePlugins.includes('@semantic-release/github'),
        npm: releasePlugins.includes('@semantic-release/npm'),
      },
      requiringNodeModules,
      versionsText,
    };
    config.eslintBase = getEslintExtensionBase(config);
    if (
      config.containingGemfile ||
      config.containingGoMod ||
      config.containingPackageJson ||
      config.containingPoetryLock ||
      config.containingPomXml ||
      config.containingPubspecYaml ||
      config.containingTemplateYaml
    ) {
      return config;
    }
  } catch (e) {
    // do nothing
  }
  return null;
}

function getEslintExtensionBase(config: PackageConfig): string | undefined {
  if (config.containingTypeScript) {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-ts-react';
    } else {
      return '@willbooster/eslint-config-ts';
    }
  } else {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-js-react';
    } else if (config.containingJavaScript) {
      return '@willbooster/eslint-config-js';
    }
  }
  return undefined;
}
