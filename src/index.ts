import path from 'path';
import glob from 'glob';
import yargs from 'yargs';
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

async function main(): Promise<void> {
  const argv = yargs
    .command('willboosterify <paths...>', 'Generate/update project files for WillBooster')
    .demandCommand(1)
    .alias('d', 'skipDeps')
    .boolean('skipDeps')
    .default('skipDeps', false)
    .describe('skipDeps', 'Skip dependency installation')
    .alias('v', 'verbose')
    .boolean('verbose')
    .default('verbose', false).argv;

  for (const rootDirPath of argv._) {
    if (typeof rootDirPath === 'number') continue;

    const rootConfig = getPackageConfig(rootDirPath);
    if (rootConfig == null) {
      console.error(`there is no valid package.json in ${rootDirPath}`);
      continue;
    }

    const subDirPaths = rootConfig.containingSubPackageJsons
      ? glob.sync('packages/*', { cwd: rootDirPath }).map((subDirPath) => path.resolve(rootDirPath, subDirPath))
      : [];
    const subPackageConfigs = subDirPaths
      .map((subDirPath) => getPackageConfig(subDirPath))
      .filter((config) => !!config) as PackageConfig[];
    const allPackageConfigs = [rootConfig, ...subPackageConfigs];
    const allNodePackageConfigs = [rootConfig, ...subPackageConfigs.filter((config) => config.containingPackageJson)];

    if (argv.verbose) {
      for (const config of allPackageConfigs) {
        console.log(config);
      }
    }

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
    if (rootConfig.containingSubPackageJsons) {
      rootPromises.push(generateLernaJson(rootConfig));
    }
    await Promise.all(rootPromises);

    const promises: Promise<void>[] = [];
    for (const config of allNodePackageConfigs) {
      promises.push(generatePrettierignore(config), generateLintstagedrc(config));
      if (config.containingTypeScript || config.containingTypeScriptInPackages) {
        promises.push(generateTsconfig(config));
      }
      if (
        config.containingJavaScript ||
        config.containingJavaScriptInPackages ||
        config.containingTypeScript ||
        config.containingTypeScriptInPackages
      ) {
        promises.push(generateEslintrc(config, rootConfig), generateEslintignore(config));
      }
    }
    await Promise.all(promises);
    let yarnInstallRequired = false;
    for (const config of allNodePackageConfigs) {
      yarnInstallRequired ||= await generatePackageJson(config, allNodePackageConfigs, argv.skipDeps);
    }
    if (yarnInstallRequired) {
      spawnSync('yarn', ['install'], rootDirPath);
    }
    spawnSync('yarn', ['cleanup'], rootDirPath);
  }
}

main().then();
