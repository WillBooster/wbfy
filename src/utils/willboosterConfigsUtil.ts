import type { PackageConfig } from '../packageConfig.js';

const ESLINT_CONFIG_PREFIX = '@willbooster/eslint-config-';
const pinnedDependencySpecifiers = {
  '@eslint/js': '^9',
  eslint: '^9',
  typescript: '^5',
} as const;

export function shouldSkipWillboosterConfigsEslintPackage(config: PackageConfig): boolean {
  return config.isWillBoosterConfigs && config.packageJson?.name?.startsWith(ESLINT_CONFIG_PREFIX) === true;
}

export function getWillboosterConfigsDependencySpecifier(
  dependency: string,
  config: PackageConfig
): string | undefined {
  if (dependency in pinnedDependencySpecifiers) {
    return `${dependency}@${pinnedDependencySpecifiers[dependency as keyof typeof pinnedDependencySpecifiers]}`;
  }

  if (!config.isWillBoosterConfigs) {
    return undefined;
  }

  return undefined;
}
