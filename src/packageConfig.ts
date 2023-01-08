import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { globbySync } from 'globby';
import { simpleGit } from 'simple-git';
import { PackageJson } from 'type-fest';

import { gitHubUtil, octokit } from './utils/githubUtil.js';

export interface PackageConfig {
  dirPath: string;
  root: boolean;
  publicRepo: boolean;
  referredByOtherRepo: boolean;
  repository?: string;
  esmPackage: boolean;
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
    blitz?: string;
    firebase: boolean;
    playwright: boolean;
    prisma: boolean;
    pyright: boolean;
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
  versionsText?: string;
  packageJson?: PackageJson;
}

export async function getPackageConfig(dirPath: string): Promise<PackageConfig | undefined> {
  const packageJsonPath = path.resolve(dirPath, 'package.json');
  try {
    const containingPackageJson = fs.existsSync(packageJsonPath);
    let dependencies: PackageJson['dependencies'] = {};
    let devDependencies: PackageJson['devDependencies'] = {};
    let packageJson: PackageJson = {};
    let esmPackage = false;
    if (containingPackageJson) {
      const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8');
      packageJson = JSON.parse(packageJsonText);
      dependencies = packageJson.dependencies ?? {};
      devDependencies = packageJson.devDependencies ?? {};
      esmPackage = packageJson.type === 'module';
    }

    let releaseBranches: string[] = [];
    let releasePlugins: string[] = [];
    try {
      const releasercJsonPath = path.resolve(dirPath, '.releaserc.json');
      const json = JSON.parse(await fsp.readFile(releasercJsonPath, 'utf8'));
      releaseBranches = json?.branches || [];
      releasePlugins = json?.plugins?.flat() || [];
    } catch {
      // do nothing
    }

    const isRoot =
      path.basename(path.resolve(dirPath, '..')) !== 'packages' ||
      !fs.existsSync(path.resolve(dirPath, '..', '..', 'package.json'));

    let repoInfo: Record<string, any> | undefined;
    if (isRoot) {
      repoInfo = await fetchRepoInfo(dirPath, packageJson);
    }

    let versionsText = '';
    try {
      const content = await fsp.readFile(path.resolve(dirPath, '.tool-versions'), 'utf8');
      versionsText += content.trim();
    } catch {
      // do nothing
    }
    for (const [prefix, name] of [
      ['node', 'nodejs'],
      ['python', 'python'],
    ]) {
      try {
        const nodeVersionContent = await fsp.readFile(path.resolve(dirPath, `.${prefix}-version`), 'utf8');
        if (versionsText) {
          versionsText += '\n';
        }
        versionsText += name + ' ' + nodeVersionContent.trim();
      } catch {
        // do nothing
      }
    }

    const config: PackageConfig = {
      dirPath,
      root: isRoot,
      publicRepo: repoInfo?.private === false,
      referredByOtherRepo: !!packageJson.files,
      repository: repoInfo?.full_name ? `github:${repoInfo?.full_name}` : undefined,
      esmPackage,
      willBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      containingSubPackageJsons: containsAny('packages/**/package.json', dirPath),
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
      containingJavaScript: containsAny('@(app|src|__tests__|scripts)/**/*.{cjs,mjs,js,jsx}', dirPath),
      containingTypeScript: containsAny('@(app|src|__tests__|scripts)/**/*.{cts,mts,ts,tsx}', dirPath),
      containingJsxOrTsx: containsAny('@(app|src|__tests__)/**/*.{t,j}sx', dirPath),
      containingJavaScriptInPackages: containsAny(
        'packages/**/@(app|src|__tests__|scripts)/**/*.{cjs,mjs,js,jsx}',
        dirPath
      ),
      containingTypeScriptInPackages: containsAny(
        'packages/**/@(app|src|__tests__|scripts)/**/*.{cts,mts,ts,tsx}',
        dirPath
      ),
      containingJsxOrTsxInPackages: containsAny('packages/**/@(app|src|__tests__)/**/*.{t,j}sx', dirPath),
      depending: {
        blitz: (dependencies['blitz'] || devDependencies['blitz'] || '').replace('^', '')[0],
        firebase: !!devDependencies['firebase-tools'],
        playwright: !!devDependencies['playwright'],
        prisma: !!dependencies['prisma'],
        pyright: !!devDependencies['pyright'],
        reactNative: !!dependencies['react-native'],
        semanticRelease: !!(
          devDependencies['semantic-release'] ||
          releaseBranches.length > 0 ||
          releasePlugins.length > 0
        ),
        storybook: !!devDependencies['@storybook/react'],
      },
      release: {
        branches: releaseBranches,
        github: releasePlugins.includes('@semantic-release/github'),
        npm: releasePlugins.includes('@semantic-release/npm'),
      },
      versionsText,
      packageJson,
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
  } catch {
    // do nothing
  }
}

function containsAny(pattern: string, dirPath: string): boolean {
  return globbySync(pattern, { dot: true, cwd: dirPath }).length > 0;
}

function getEslintExtensionBase(config: PackageConfig): string | undefined {
  if (config.containingTypeScript) {
    return config.containingJsxOrTsx ? '@willbooster/eslint-config-ts-react' : '@willbooster/eslint-config-ts';
  } else {
    if (config.containingJsxOrTsx) {
      return '@willbooster/eslint-config-js-react';
    } else if (config.containingJavaScript) {
      return '@willbooster/eslint-config-js';
    }
  }
}

async function fetchRepoInfo(dirPath: string, packageJson: PackageJson): Promise<Record<string, any> | undefined> {
  const git = simpleGit(dirPath);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find((r) => r.name === 'origin');
  const remoteUrl = origin?.refs?.fetch ?? origin?.refs?.push;
  if (typeof remoteUrl === 'string') {
    const json = await requestRepoInfo(remoteUrl);
    if (json) return json;
  }

  const url = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url;
  if (url) {
    const json = await requestRepoInfo(url);
    if (json && json.message !== 'Not Found') return json;
  }
}

async function requestRepoInfo(urlOrFullName: string): Promise<Record<string, any> | undefined> {
  const [org, name] = gitHubUtil.getOrgAndName(urlOrFullName);
  if (!org || !name) return;

  const ret = { full_name: `${org}/${name}` };
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}', {
      owner: org,
      repo: name,
    });
    Object.assign(ret, response.data);
  } catch {
    // do nothing
  }
  return ret;
}
