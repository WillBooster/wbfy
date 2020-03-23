import path from 'path';
import { Command, flags } from '@oclif/command';
import glob from 'glob';
import { generateGitignore } from './generators/gitignore';
import { generatePrettierignore } from './generators/prettierignore';
import { generateHuskyrc } from './generators/huskyrc';
import { getPackageConfig, PackageConfig } from './utils/packageConfig';
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
import { generateIdeaSettings } from './generators/idea';

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
        ? glob.sync('packages/*', { cwd: rootDirPath }).map((subDirPath) => path.resolve(rootDirPath, subDirPath))
        : [];
      const subPackageConfigs = subDirPaths
        .map((subDirPath) => getPackageConfig(subDirPath))
        .filter((config) => !!config) as PackageConfig[];
      const allPackageConfigs = [rootConfig, ...subPackageConfigs];
      const allNodePackageConfigs = [rootConfig, ...subPackageConfigs.filter((config) => config.containingPackageJson)];

      rootConfig.containingJavaScript = allPackageConfigs.some((c) => c.containingJavaScript);
      rootConfig.containingTypeScript = allPackageConfigs.some((c) => c.containingTypeScript);
      rootConfig.containingJsxOrTsx = allPackageConfigs.some((c) => c.containingJsxOrTsx);

      const rootPromises = allPackageConfigs.map((config) => generateGitignore(config, rootConfig));
      rootPromises.push(
        generateEditorconfig(rootConfig),
        generateGitattributes(rootConfig),
        generateHuskyrc(rootConfig),
        generateIdeaSettings(rootConfig),
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
        if (config.containingTypeScript) {
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

export = GenConfigs;
