import { PackageConfig } from '../packageConfig';

export const EslintUtil = {
  getLintFixSuffix(config: PackageConfig): string {
    return config.containingJsxOrTsx ? ' --rule "{ react-hooks/exhaustive-deps: 0 }"' : '';
  },
};
