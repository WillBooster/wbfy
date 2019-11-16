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
import { generateDependabotConfig } from './generators/dependabot';
import { generateEslintrc } from './generators/eslintrc';
import { generateEslintignore } from './generators/eslintignore';
import { generatePackageJson } from './generators/packageJson';
import { spawnSync } from './utils/spawnUtil';

class GenConfigs extends Command {
  static description = 'Generator/updater for config files in WillBooster projects';

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
  };

  static args = [];

  static strict = false;

  async run(): Promise<void> {
    const { argv } = this.parse(GenConfigs);

    for (const rootDirPath of argv) {
      const rootConfig = getPackageConfig(rootDirPath);
      if (rootConfig == null) {
        console.error(`there is no valid package.json in ${rootDirPath}`);
        continue;
      }

      const subDirPaths = rootConfig.containingPackages
        ? glob.sync('packages/*', { cwd: rootDirPath }).map(subDirPath => path.resolve(rootDirPath, subDirPath))
        : [];
      const subPackageConfigs = subDirPaths
        .map(subDirPath => getPackageConfig(subDirPath))
        .filter(config => !!config) as PackageConfig[];
      const allPackageConfigs = [rootConfig, ...subPackageConfigs] as PackageConfig[];

      rootConfig.containingJavaScript =
        rootConfig.containingJavaScript || subPackageConfigs.some(c => c.containingJavaScript);
      rootConfig.containingTypeScript =
        rootConfig.containingTypeScript || subPackageConfigs.some(c => c.containingTypeScript);
      rootConfig.containingJsxOrTsx =
        rootConfig.containingJsxOrTsx || subPackageConfigs.some(c => c.containingJsxOrTsx);

      generateEditorconfig(rootConfig);
      generateHuskyrc(rootConfig);
      generateLintstagedrc(rootConfig);
      generateYarnrc(rootConfig);
      if (rootConfig.containingPackages) {
        generateLernaJson(rootConfig);
      }
      generateDependabotConfig(rootConfig);

      await Promise.all(allPackageConfigs.map(config => generateGitignore(config)));

      const promises: Promise<void>[] = [];
      for (const config of allPackageConfigs) {
        promises.push(generatePrettierignore(config));
        if (rootConfig.containingTypeScript) {
          promises.push(generateTsconfig(config));
        }
        if (config.containingJavaScript || config.containingTypeScript) {
          promises.push(generateEslintrc(config, rootConfig), generateEslintignore(config));
        }
      }
      await Promise.all(promises);
      for (const config of allPackageConfigs) {
        await generatePackageJson(config, allPackageConfigs);
      }
      spawnSync('yarn', ['format'], rootDirPath);
    }
  }
}

function getPackageConfig(dirPath: string): PackageConfig | null {
  const packageJsonPath = path.resolve(dirPath, 'package.json');
  const packageJsonText = fs.readFileSync(packageJsonPath).toString();
  try {
    const packageJson = JSON.parse(packageJsonText);
    if (!packageJson) {
      return null;
    }

    const dependencies = packageJson.dependencies || {};
    return {
      dirPath,
      root:
        path.basename(path.resolve(dirPath, '..')) != 'packages' ||
        !fs.existsSync(path.resolve(dirPath, '..', '..', 'package.json')),
      willBoosterConfigs: packageJsonPath.includes(`${path.sep}willbooster-configs`),
      containingPackages: glob.sync('packages/**/package.json', { cwd: dirPath }).length > 0,
      containingJavaScript: glob.sync('src/**/*.js?(x)', { cwd: dirPath }).length > 0,
      containingTypeScript: glob.sync('src/**/*.ts?(x)', { cwd: dirPath }).length > 0,
      containingJsxOrTsx: glob.sync('src/**/*.(t|j)sx', { cwd: dirPath }).length > 0,
      depending: {
        tsnode: !!dependencies['tsnode'],
      },
    };
  } catch (e) {
    return null;
  }
}

export = GenConfigs;
