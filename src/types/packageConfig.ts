export interface PackageConfig {
  dirPath: string;
  root: boolean;
  willBoosterConfigs: boolean;
  containingSubPackages: boolean;
  containingGemfile: boolean;
  containingGoMod: boolean;
  containingPackageJson: boolean;
  containingPomXml: boolean;
  containingPubspecYaml: boolean;
  containingTemplateYaml: boolean;
  containingJavaScript: boolean;
  containingTypeScript: boolean;
  containingJsxOrTsx: boolean;
  depending: {
    firebase: boolean;
    node: boolean;
  };
  eslintBase?: string;
}
