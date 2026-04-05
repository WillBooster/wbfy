import type { PackageConfig } from '../packageConfig.js';

const ESLINT_CONFIG_PREFIX = '@willbooster/eslint-config-';
const willboosterConfigsPinnedDependencySpecifiers = {
  '@eslint/js': '^9',
  eslint: '^9',
} as const;

export function shouldSkipWillboosterConfigsEslintPackage(config: PackageConfig): boolean {
  return config.isWillBoosterConfigs && config.packageJson?.name?.startsWith(ESLINT_CONFIG_PREFIX) === true;
}

export function getWillboosterConfigsDependencySpecifier(
  dependency: string,
  config: PackageConfig
): string | undefined {
  if (!config.isWillBoosterConfigs) return;

  switch (dependency) {
    case '@eslint/js':
    case 'eslint': {
      return `${dependency}@${willboosterConfigsPinnedDependencySpecifiers[dependency]}`;
    }
    default: {
      return undefined;
    }
  }
}
