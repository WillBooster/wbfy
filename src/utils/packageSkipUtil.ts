import type { PackageConfig } from '../packageConfig.js';

const ESLINT_CONFIG_PREFIX = '@willbooster/eslint-config-';

export function shouldSkipPackage(config: PackageConfig, rootConfig: PackageConfig): boolean {
  if (!rootConfig.isWillBoosterConfigs) return false;

  const packageName = config.packageJson?.name;
  return typeof packageName === 'string' && packageName.startsWith(ESLINT_CONFIG_PREFIX);
}
