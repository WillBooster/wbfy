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

export function getPinnedDependencySpecifier(dependency: string): string | undefined {
  if (Object.hasOwn(pinnedDependencySpecifiers, dependency)) {
    return `${dependency}@${pinnedDependencySpecifiers[dependency as keyof typeof pinnedDependencySpecifiers]}`;
  }

  return undefined;
}
