import { PackageConfig } from '../packageConfig.js';

export const EslintUtil = {
  getLintFixSuffix(config: PackageConfig): string {
    return config.containingJsxOrTsx ? ' --rule "{ react-hooks/exhaustive-deps: 0 }"' : '';
  },
};
