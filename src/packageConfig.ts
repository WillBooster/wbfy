import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';
import { simpleGit } from 'simple-git';
import type { PackageJson } from 'type-fest';
import { z } from 'zod';

import { gitHubUtil, octokit } from './utils/githubUtil.js';
import { globIgnore } from './utils/globUtil.js';

export interface PackageConfig {
  dirPath: string;
  dockerfile: string;
  isRoot: boolean;
  isPublicRepo: boolean;
  isReferredByOtherRepo: boolean;
  repository?: string;
  isBun: boolean;
  isEsmPackage: boolean;
  isWillBoosterConfigs: boolean;
  doesContainsSubPackageJsons: boolean;
  doesContainsDockerfile: boolean;
  doesContainsGemfile: boolean;
  doesContainsGoMod: boolean;
  doesContainsPackageJson: boolean;
  doesContainsPoetryLock: boolean;
  doesContainsPomXml: boolean;
  doesContainsPubspecYaml: boolean;
  doesContainsTemplateYaml: boolean;
  doesContainsVscodeSettingsJson: boolean;

  doesContainsJavaScript: boolean;
  doesContainsTypeScript: boolean;
  doesContainsJsxOrTsx: boolean;
  doesContainsJavaScriptInPackages: boolean;
  doesContainsTypeScriptInPackages: boolean;
  doesContainsJsxOrTsxInPackages: boolean;
  depending: {
    blitz: boolean;
    firebase: boolean;
    litestream: boolean;
    next: boolean;
    playwrightTest: boolean;
    prisma: boolean;
    pyright: boolean;
    reactNative: boolean;
    semanticRelease: boolean;
    storybook: boolean;
    wb: boolean;
  };
  release: {
    branches: string[];
    github: boolean;
    npm: boolean;
  };
  eslintBase?: EslintExtensionBase;
  versionsText?: string;
  packageJson?: PackageJson;
  wbfyJson?: WbfyJson;
}

type WbfyJson = z.infer<typeof wbfyJsonSchema>;

const wbfyJsonSchema = z.object({
  typos: z
    .object({
      all: z.record(z.string()).optional(),
      doc: z.record(z.string()).optional(),
      ts: z.record(z.string()).optional(),
      text: z.record(z.string()).optional(),
    })
    .optional(),
});

export async function getPackageConfig(
  dirPath: string,
  rootConfig?: PackageConfig
): Promise<PackageConfig | undefined> {
  const packageJsonPath = path.resolve(dirPath, 'package.json');
  try {
    const doesContainsPackageJson = fs.existsSync(packageJsonPath);
    let dependencies: PackageJson['dependencies'] = {};
    let devDependencies: PackageJson['devDependencies'] = {};
    let packageJson: PackageJson = {};
    let esmPackage = false;
    if (doesContainsPackageJson) {
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

    let repoInfo: Record<string, unknown> | undefined;
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
      ['java', 'java'],
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

    let dockerfile = '';
    try {
      dockerfile = await fsp.readFile(path.resolve(dirPath, 'Dockerfile'), 'utf8');
    } catch {
      // do nothing
    }

    // Read wbfy.json
    const wbfyJsonPath = path.resolve(dirPath, 'wbfy.json');
    let wbfyJson: WbfyJson | undefined;
    try {
      const wbfyJsonText = await fsp.readFile(wbfyJsonPath, 'utf8');
      wbfyJson = wbfyJsonSchema.parse(JSON.parse(wbfyJsonText));
    } catch {
      // do nothing
    }

    const config: PackageConfig = {
      dirPath,
      dockerfile,
      isRoot,
      isPublicRepo: repoInfo?.private === false,
      isReferredByOtherRepo: !!packageJson.files,
      repository: repoInfo?.full_name ? `github:${repoInfo?.full_name}` : undefined,
      isBun: rootConfig?.isBun || fs.existsSync(path.join(dirPath, 'bunfig.toml')),
      isEsmPackage: esmPackage,
      isWillBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      doesContainsSubPackageJsons: containsAny('packages/**/package.json', dirPath),
      doesContainsDockerfile: !!dockerfile || fs.existsSync(path.resolve(dirPath, 'docker-compose.yml')),
      doesContainsGemfile: fs.existsSync(path.resolve(dirPath, 'Gemfile')),
      doesContainsGoMod: fs.existsSync(path.resolve(dirPath, 'go.mod')),
      doesContainsPackageJson: fs.existsSync(path.resolve(dirPath, 'package.json')),
      doesContainsPoetryLock: fs.existsSync(path.resolve(dirPath, 'poetry.lock')),
      doesContainsPomXml: fs.existsSync(path.resolve(dirPath, 'pom.xml')),
      doesContainsPubspecYaml: fs.existsSync(path.resolve(dirPath, 'pubspec.yaml')),
      doesContainsTemplateYaml: fs.existsSync(path.resolve(dirPath, 'template.yaml')),
      doesContainsVscodeSettingsJson: fs.existsSync(path.resolve(dirPath, '.vscode', 'settings.json')),
      doesContainsJavaScript: containsAny('{app,src,tests,scripts}/**/*.{cjs,mjs,js,jsx}', dirPath),
      doesContainsTypeScript: containsAny('{app,src,tests,scripts}/**/*.{cts,mts,ts,tsx}', dirPath),
      doesContainsJsxOrTsx: containsAny('{app,src,tests}/**/*.{t,j}sx', dirPath),
      doesContainsJavaScriptInPackages: containsAny(
        'packages/**/{app,src,tests,scripts}/**/*.{cjs,mjs,js,jsx}',
        dirPath
      ),
      doesContainsTypeScriptInPackages: containsAny(
        'packages/**/{app,src,tests,scripts}/**/*.{cts,mts,ts,tsx}',
        dirPath
      ),
      doesContainsJsxOrTsxInPackages: containsAny('packages/**/{app,src,tests}/**/*.{t,j}sx', dirPath),
      depending: {
        blitz: !!dependencies['blitz'],
        firebase: !!devDependencies['firebase-tools'],
        litestream: dockerfile.includes('install-litestream.sh'),
        next: !!dependencies['next'],
        playwrightTest:
          !!dependencies['@playwright/test'] ||
          !!devDependencies['@playwright/test'] ||
          !!devDependencies['playwright'],
        prisma: !!dependencies['@prisma/client'] || !!devDependencies['prisma'],
        pyright: !!devDependencies['pyright'],
        reactNative: !!dependencies['react-native'],
        semanticRelease: !!(
          devDependencies['semantic-release'] ||
          releaseBranches.length > 0 ||
          releasePlugins.length > 0
        ),
        storybook: !!devDependencies['@storybook/react'],
        wb: !!dependencies['@willbooster/wb'] || !!devDependencies['@willbooster/wb'],
      },
      release: {
        branches: releaseBranches,
        github: releasePlugins.includes('@semantic-release/github'),
        npm: releasePlugins.includes('@semantic-release/npm'),
      },
      versionsText,
      packageJson,
      wbfyJson,
    };
    if (!config.isBun) {
      config.eslintBase = getEslintExtensionBase(config);
    }
    if (
      config.doesContainsGemfile ||
      config.doesContainsGoMod ||
      config.doesContainsPackageJson ||
      config.doesContainsPoetryLock ||
      config.doesContainsPomXml ||
      config.doesContainsPubspecYaml ||
      config.doesContainsTemplateYaml
    ) {
      return config;
    }
  } catch {
    // do nothing
  }
}

function containsAny(pattern: string, dirPath: string): boolean {
  return fg.globSync(pattern, { dot: true, cwd: dirPath, ignore: globIgnore }).length > 0;
}

export type EslintExtensionBase =
  | '@willbooster/eslint-config-ts-react'
  | '@willbooster/eslint-config-ts'
  | '@willbooster/eslint-config-js-react'
  | '@willbooster/eslint-config-js'
  | '@willbooster/eslint-config-next'
  | '@willbooster/eslint-config-blitz-next';

function getEslintExtensionBase(config: PackageConfig): EslintExtensionBase | undefined {
  if (config.depending.blitz) {
    return '@willbooster/eslint-config-blitz-next';
  } else if (config.depending.next) {
    return '@willbooster/eslint-config-next';
  } else if (config.doesContainsTypeScript) {
    return config.doesContainsJsxOrTsx ? '@willbooster/eslint-config-ts-react' : '@willbooster/eslint-config-ts';
  } else {
    if (config.doesContainsJsxOrTsx) {
      return '@willbooster/eslint-config-js-react';
    } else if (config.doesContainsJavaScript) {
      return '@willbooster/eslint-config-js';
    }
  }
}

async function fetchRepoInfo(dirPath: string, packageJson: PackageJson): Promise<Record<string, unknown> | undefined> {
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

async function requestRepoInfo(urlOrFullName: string): Promise<Record<string, unknown> | undefined> {
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
