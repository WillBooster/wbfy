import path from 'path';
import fs from 'fs';
import glob from 'glob';
import { Command, flags } from '@oclif/command';
import { generateGitignore } from './generators/gitignore';
import { generatePrettierignore } from './generators/prettierignore';
import { generateHuskyrc } from './generators/huskyrc';
import { PackageConfig } from './types/packageConfig';
import { generateLintstagedrc } from './generators/lintstagedrc';
import { generateEditorconfig } from './generators/editorconfig';
import { generateYarnrc } from './generators/yarnrc';
import { generateLernaJson } from './generators/lernaJson';
import { generateTsconfig } from './generators/tsconfig';
import { generateEslintrc } from './generators/eslintrc';
import { generateEslintignore } from './generators/eslintignore';
import { generatePackageJson } from './generators/packageJson';
import { spawnSync } from './utils/spawnUtil';
import { generateRenovateJson } from './generators/renovaterc';
import { generateGitattributes } from './generators/gitattributes';

class GenConfigs extends Command {
  static description = 'Generator/updater for config files in WillBooster projects';

  static flags = {
    skipDeps: flags.boolean({ char: 'd' }),
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
  };

  static args = [];

  static strict = false;

  async run(): Promise<void> {
    const { argv, flags } = this.parse(GenConfigs);

    for (const rootDirPath of argv) {
      const rootConfig = getPackageConfig(rootDirPath);
      if (rootConfig == null) {
        console.error(`there is no valid package.json in ${rootDirPath}`);
        continue;
      }

      const subDirPaths = rootConfig.containingSubPackages
        ? glob.sync('packages/*', { cwd: rootDirPath }).map(subDirPath => path.resolve(rootDirPath, subDirPath))
        : [];
      const subPackageConfigs = subDirPaths
        .map(subDirPath => getPackageConfig(subDirPath))
        .filter(config => !!config) as PackageConfig[];
      const allPackageConfigs = [rootConfig, ...subPackageConfigs];
      const allNodePackageConfigs = [rootConfig, ...subPackageConfigs.filter(config => config.containingPackageJson)];

      rootConfig.containingJavaScript = allPackageConfigs.some(c => c.containingJavaScript);
      rootConfig.containingTypeScript = allPackageConfigs.some(c => c.containingTypeScript);
      rootConfig.containingJsxOrTsx = allPackageConfigs.some(c => c.containingJsxOrTsx);

      const rootPromises = allPackageConfigs.map(config => generateGitignore(config, rootConfig));
      rootPromises.push(
        generateEditorconfig(rootConfig),
        generateGitattributes(rootConfig),
        generateHuskyrc(rootConfig),
        generateLintstagedrc(rootConfig),
        generateYarnrc(rootConfig),
        generateRenovateJson(rootConfig)
      );
      if (rootConfig.containingSubPackages) {
        rootPromises.push(generateLernaJson(rootConfig));
      }
      await Promise.all(rootPromises);

      const promises: Promise<void>[] = [];
      for (const config of allNodePackageConfigs) {
        promises.push(generatePrettierignore(config));
        if (rootConfig.containingTypeScript) {
          promises.push(generateTsconfig(config));
        }
        if (config.containingJavaScript || config.containingTypeScript) {
          promises.push(generateEslintrc(config, rootConfig), generateEslintignore(config));
        }
      }
      await Promise.all(promises);
      for (const config of allNodePackageConfigs) {
        if (config.containingPackageJson) {
          await generatePackageJson(config, allNodePackageConfigs, flags.skipDeps);
        }
      }
      spawnSync('yarn', ['cleanup'], rootDirPath);
    }
  }
}

function getPackageConfig(dirPath: string): PackageConfig | null {
  const packageJsonPath = path.resolve(dirPath, 'package.json');
  try {
    const containingPackageJson = fs.existsSync(packageJsonPath);
    let devDependencies: { [key: string]: string } = {};
    let scripts: { [key: string]: string } = {};
    if (containingPackageJson) {
      const packageJsonText = fs.readFileSync(packageJsonPath).toString();
      const packageJson = JSON.parse(packageJsonText);
      devDependencies = packageJson.devDependencies || {};
      scripts = packageJson.scripts || {};
    }

    const config = {
      dirPath,
      root:
        path.basename(path.resolve(dirPath, '..')) != 'packages' ||
        !fs.existsSync(path.resolve(dirPath, '..', '..', 'package.json')),
      willBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      containingSubPackages: glob.sync('packages/**/package.json', { cwd: dirPath }).length > 0,
      containingJavaScript: glob.sync('src/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingGemfile: fs.existsSync(path.resolve(dirPath, 'Gemfile')),
      containingGoMod: fs.existsSync(path.resolve(dirPath, 'go.mod')),
      containingPackageJson: fs.existsSync(path.resolve(dirPath, 'package.json')),
      containingPomXml: fs.existsSync(path.resolve(dirPath, 'pom.xml')),
      containingPubspecYaml: fs.existsSync(path.resolve(dirPath, 'pubspec.yaml')),
      containingTemplateYaml: fs.existsSync(path.resolve(dirPath, 'template.yaml')),
      containingTypeScript: glob.sync('src/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsx: glob.sync('src/**/*.{t,j}sx', { cwd: dirPath }).length > 0,
      depending: {
        firebase: !!devDependencies['firebase-tools'],
        tsnode: Object.values(scripts).some(script => script.includes('ts-node')),
      },
    };
    if (
      config.containingGemfile ||
      config.containingGoMod ||
      config.containingPackageJson ||
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

export = GenConfigs;
