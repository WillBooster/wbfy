import type { PackageConfig } from '../packageConfig.js';

export const EslintUtil = {
  getLintFixSuffix(config: PackageConfig): string {
    return config.doesContainsJsxOrTsx ? ' --rule "{ react-hooks/exhaustive-deps: 0 }"' : '';
  },
};
