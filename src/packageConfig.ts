import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import glob from 'glob';
import yaml from 'js-yaml';
import { simpleGit } from 'simple-git';

import { gitHubUtil, octokit } from './utils/githubUtil';

export interface PackageConfig {
  dirPath: string;
  root: boolean;
  publicRepo: boolean;
  repository?: string;
  willBoosterConfigs: boolean;
  containingSubPackageJsons: boolean;
  containingDockerfile: boolean;
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

    const isRoot =
      path.basename(path.resolve(dirPath, '..')) !== 'packages' ||
      !fs.existsSync(path.resolve(dirPath, '..', '..', 'package.json'));

    let repoInfo: Record<string, any> | undefined;
    if (isRoot) {
      repoInfo = await getRepoInfo(dirPath, packageJson);
    }

    let versionsText: string | undefined;
    try {
      versionsText = await fsp.readFile(path.resolve(dirPath, '.tool-versions'), 'utf-8');
    } catch (_) {
      try {
        versionsText = 'nodejs ' + (await fsp.readFile(path.resolve(dirPath, '.node-version'), 'utf-8')).trim();
      } catch (_) {
        // do nothing
      }
    }

    const config: PackageConfig = {
      dirPath,
      root: isRoot,
      publicRepo: repoInfo?.private === false,
      repository: repoInfo?.full_name ? `github:${repoInfo?.full_name}` : undefined,
      willBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      containingSubPackageJsons: glob.sync('packages/**/package.json', { cwd: dirPath }).length > 0,
      containingDockerfile:
        fs.existsSync(path.resolve(dirPath, 'Dockerfile')) ||
        fs.existsSync(path.resolve(dirPath, 'docker-compose.yml')),
      containingGemfile: fs.existsSync(path.resolve(dirPath, 'Gemfile')),
      containingGoMod: fs.existsSync(path.resolve(dirPath, 'go.mod')),
      containingPackageJson: fs.existsSync(path.resolve(dirPath, 'package.json')),
      containingPoetryLock: fs.existsSync(path.resolve(dirPath, 'poetry.lock')),
      containingPomXml: fs.existsSync(path.resolve(dirPath, 'pom.xml')),
      containingPubspecYaml: fs.existsSync(path.resolve(dirPath, 'pubspec.yaml')),
      containingTemplateYaml: fs.existsSync(path.resolve(dirPath, 'template.yaml')),
      containingJavaScript: glob.sync('@(app|src|__tests__|scripts)/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScript: glob.sync('@(app|src|__tests__|scripts)/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsx: glob.sync('@(app|src|__tests__)/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      containingJavaScriptInPackages:
        glob.sync('packages/**/@(app|src|__tests__|scripts)/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScriptInPackages:
        glob.sync('packages/**/@(app|src|__tests__|scripts)/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsxInPackages:
        glob.sync('packages/**/@(app|src|__tests__)/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      depending: {
        blitz: !!(dependencies['blitz'] || devDependencies['blitz']),
        firebase: !!devDependencies['firebase-tools'],
        prisma: !!devDependencies['prisma'],
        reactNative: !!dependencies['react-native'],
        semanticRelease: !!devDependencies['semantic-release'] || !releaseBranches.length || !releasePlugins.length,
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

async function getRepoInfo(dirPath: string, packageJson: any): Promise<Record<string, any> | undefined> {
  const git = simpleGit(dirPath);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find((r) => r.name === 'origin');
  const remoteUrl = origin?.refs?.fetch ?? origin?.refs?.push;
  if (typeof remoteUrl === 'string') {
    const json = await fetchRepoInfo(remoteUrl);
    if (json) return json;
  }

  const url = packageJson.repository?.url ?? packageJson.repository;
  if (typeof url === 'string') {
    const json = await fetchRepoInfo(url);
    if (json && json.message !== 'Not Found') return json;
  }
}

async function fetchRepoInfo(urlOrFullName: string): Promise<Record<string, any> | undefined> {
  const [org, name] = gitHubUtil.getOrgAndName(urlOrFullName);
  if (!org || !name) return;

  const ret = { full_name: `${org}/${name}` };
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}', {
      owner: org,
      repo: name,
    });
    Object.assign(ret, response.data);
  } catch (e) {
    // do nothing
  }
  return ret;
}
