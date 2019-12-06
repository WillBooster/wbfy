export interface PackageConfig {
  dirPath: string;
  root: boolean;
  willBoosterConfigs: boolean;
  containingPackages: boolean;
  containingPubspecYaml: boolean;
  containingJavaScript: boolean;
  containingTypeScript: boolean;
  containingJsxOrTsx: boolean;
  depending: {
    firebase: boolean;
    tsnode: boolean;
  };
  eslintBase?: string;
}
