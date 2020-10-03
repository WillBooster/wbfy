import path from 'path';
import fs from 'fs';
import glob from 'glob';

export interface PackageConfig {
  dirPath: string;
  root: boolean;
  willBoosterConfigs: boolean;
  containingSubPackages: boolean;
  containingGemfile: boolean;
  containingGoMod: boolean;
  containingPackageJson: boolean;
  containingPoetryLock: boolean;
  containingPomXml: boolean;
  containingPubspecYaml: boolean;
  containingTemplateYaml: boolean;
  containingYarnrcYml: boolean;

  containingJavaScript: boolean;
  containingTypeScript: boolean;
  containingJsxOrTsx: boolean;
  containingJavaScriptInPackages: boolean;
  containingTypeScriptInPackages: boolean;
  containingJsxOrTsxInPackages: boolean;
  depending: {
    firebase: boolean;
    reactNative: boolean;
    tsnode: boolean;
  };
  eslintBase?: string;
}

export function getPackageConfig(dirPath: string): PackageConfig | null {
  const packageJsonPath = path.resolve(dirPath, 'package.json');
  try {
    const containingPackageJson = fs.existsSync(packageJsonPath);
    let dependencies: { [key: string]: string } = {};
    let devDependencies: { [key: string]: string } = {};
    let scripts: { [key: string]: string } = {};
    let packageJson: any = {};
    if (containingPackageJson) {
      const packageJsonText = fs.readFileSync(packageJsonPath).toString();
      packageJson = JSON.parse(packageJsonText);
      dependencies = packageJson.dependencies ?? {};
      devDependencies = packageJson.devDependencies ?? {};
      scripts = packageJson.scripts ?? {};
    }

    const config: PackageConfig = {
      dirPath,
      root:
        path.basename(path.resolve(dirPath, '..')) != 'packages' ||
        !fs.existsSync(path.resolve(dirPath, '..', '..', 'package.json')),
      willBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      containingSubPackages: glob.sync('packages/**/package.json', { cwd: dirPath }).length > 0,
      containingGemfile: fs.existsSync(path.resolve(dirPath, 'Gemfile')),
      containingGoMod: fs.existsSync(path.resolve(dirPath, 'go.mod')),
      containingPackageJson: fs.existsSync(path.resolve(dirPath, 'package.json')),
      containingPoetryLock: fs.existsSync(path.resolve(dirPath, 'poetry.lock')),
      containingPomXml: fs.existsSync(path.resolve(dirPath, 'pom.xml')),
      containingPubspecYaml: fs.existsSync(path.resolve(dirPath, 'pubspec.yaml')),
      containingYarnrcYml: fs.existsSync(path.resolve(dirPath, '.yarnrc.yml')),
      containingTemplateYaml: fs.existsSync(path.resolve(dirPath, 'template.yaml')),
      containingJavaScript: glob.sync('src/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScript: glob.sync('src/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsx: glob.sync('src/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      containingJavaScriptInPackages: glob.sync('packages/**/src/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScriptInPackages: glob.sync('packages/**/src/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsxInPackages: glob.sync('packages/**/src/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      depending: {
        firebase: !!devDependencies['firebase-tools'],
        reactNative: !!dependencies['react-native'],
        tsnode:
          Object.values(scripts).some((script) => script.includes('ts-node')) ||
          Object.keys(devDependencies).some((dep) => dep.includes('ts-node')) ||
          packageJson?.engines?.node?.startsWith('10'),
      },
    };
    if (
      config.containingGemfile ||
      config.containingGoMod ||
      config.containingPackageJson ||
      config.containingPoetryLock ||
      config.containingPomXml ||
      config.containingPubspecYaml ||
      config.containingTemplateYaml
    ) {
      return config;
    }
  } catch (e) {
    // do nothing
  }
  return null;
}
