import type { PackageConfig } from '../packageConfig.js';

const ESLINT_CONFIG_PREFIX = '@willbooster/eslint-config-';
const pinnedDependencySpecifiers = {
  '@eslint/js': '^9',
  eslint: '^9',
  // 1.22.0 is published without dist/, which breaks ESLint config resolution.
  'eslint-plugin-sort-class-members': '1.21.0',
  typescript: '^5',
} as const;

export function shouldSkipWillboosterConfigsEslintPackage(config: PackageConfig): boolean {
  return config.isWillBoosterConfigs && config.packageJson?.name?.startsWith(ESLINT_CONFIG_PREFIX) === true;
}

export function getPinnedDependencySpecifier(dependency: string): string | undefined {
  for (const [key, value] of Object.entries(pinnedDependencySpecifiers)) {
    if (key === dependency) {
      return `${key}@${value}`;
    }
  }

  return undefined;
}
