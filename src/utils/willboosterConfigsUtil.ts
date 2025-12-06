import type { PackageConfig } from '../packageConfig.js';

const ESLINT_CONFIG_PREFIX = '@willbooster/eslint-config-';

export function shouldSkipWillboosterConfigsEslintPackage(config: PackageConfig): boolean {
  return config.isWillBoosterConfigs && config.packageJson?.name?.startsWith(ESLINT_CONFIG_PREFIX) === true;
}
