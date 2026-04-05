import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'vitest';

import { generateLefthookUpdatingPackageJson } from '../src/generators/lefthook.js';
import type { PackageConfig } from '../src/packageConfig.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => fs.promises.rm(dirPath, { force: true, recursive: true })));
  tempDirs.length = 0;
});

test('includes python files in cleanup glob when poetry is used', async () => {
  const dirPath = createTempDir();

  await generateLefthookUpdatingPackageJson(
    createConfig({
      dirPath,
      doesContainPackageJson: true,
      doesContainPoetryLock: true,
      doesContainTypeScript: true,
    })
  );

  const lefthookConfig = await fs.promises.readFile(path.join(dirPath, 'lefthook.yml'), 'utf8');
  expect(lefthookConfig).toContain("glob: '**/*.{");
  expect(lefthookConfig).toContain('py');
  expect(lefthookConfig).toContain('python_files=');
  expect(lefthookConfig).not.toContain('lint-staged');
});

test('includes dart files in cleanup glob when pubspec is present', async () => {
  const dirPath = createTempDir();

  await generateLefthookUpdatingPackageJson(
    createConfig({
      dirPath,
      doesContainPackageJson: true,
      doesContainPubspecYaml: true,
    })
  );

  const lefthookConfig = await fs.promises.readFile(path.join(dirPath, 'lefthook.yml'), 'utf8');
  expect(lefthookConfig).toContain("glob: '**/*.{");
  expect(lefthookConfig).toContain('dart');
  expect(lefthookConfig).toContain('dart_files=');
  expect(lefthookConfig).not.toContain('lint-staged');
});

function createTempDir(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wbfy-lefthook-'));
  tempDirs.push(dirPath);
  return dirPath;
}

function createConfig(overrides: Partial<PackageConfig> = {}): PackageConfig {
  return {
    dirPath: '/tmp',
    dockerfile: '',
    isRoot: true,
    isPublicRepo: true,
    isReferredByOtherRepo: false,
    repository: 'github:WillBooster/example',
    isWillBoosterRepo: true,
    isBun: false,
    isEsmPackage: false,
    isWillBoosterConfigs: false,
    doesContainSubPackageJsons: false,
    doesContainDockerfile: false,
    doesContainGemfile: false,
    doesContainGoMod: false,
    doesContainPackageJson: false,
    doesContainPoetryLock: false,
    doesContainPomXml: false,
    doesContainPubspecYaml: false,
    doesContainTemplateYaml: false,
    doesContainVscodeSettingsJson: false,
    doesContainJavaScript: false,
    doesContainTypeScript: false,
    doesContainJsxOrTsx: false,
    doesContainJavaScriptInPackages: false,
    doesContainTypeScriptInPackages: false,
    doesContainJsxOrTsxInPackages: false,
    hasStartTestServer: false,
    depending: {
      blitz: false,
      firebase: false,
      genI18nTs: false,
      litestream: false,
      next: false,
      playwrightTest: false,
      prisma: false,
      pyright: false,
      react: false,
      reactNative: false,
      semanticRelease: false,
      storybook: false,
      wb: false,
    },
    release: {
      branches: [],
      github: false,
      npm: false,
    },
    hasVersionSettings: false,
    packageJson: {},
    ...overrides,
  };
}
