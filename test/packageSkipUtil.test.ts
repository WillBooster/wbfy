import { describe, expect, test } from 'vitest';

import type { PackageConfig } from '../src/packageConfig.js';
import { shouldSkipPackage } from '../src/utils/packageSkipUtil.js';

describe('shouldSkipPackage', () => {
  test('skips ESLint config packages in willbooster-configs', () => {
    const rootConfig = createConfig({ isRoot: true, isWillBoosterConfigs: true });
    const eslintConfig = createConfig({
      isWillBoosterConfigs: true,
      packageJson: { name: '@willbooster/eslint-config-ts' },
    });

    expect(shouldSkipPackage(eslintConfig, rootConfig)).toBe(true);
  });

  test('does not skip non-ESLint packages in willbooster-configs', () => {
    const rootConfig = createConfig({ isRoot: true, isWillBoosterConfigs: true });
    const prettierConfig = createConfig({
      isWillBoosterConfigs: true,
      packageJson: { name: '@willbooster/prettier-config' },
    });

    expect(shouldSkipPackage(prettierConfig, rootConfig)).toBe(false);
  });

  test('does not skip ESLint packages outside willbooster-configs', () => {
    const rootConfig = createConfig({ isRoot: true, isWillBoosterConfigs: false });
    const eslintConfig = createConfig({
      packageJson: { name: '@willbooster/eslint-config-ts' },
    });

    expect(shouldSkipPackage(eslintConfig, rootConfig)).toBe(false);
  });
});

function createConfig(overrides: Partial<PackageConfig> = {}): PackageConfig {
  return {
    dirPath: '/tmp',
    dockerfile: '',
    isRoot: false,
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
    doesContainPackageJson: true,
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
    hasStartTest: false,
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
    ...overrides,
  };
}
