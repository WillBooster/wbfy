import fs from 'fs';
import path from 'path';

import glob from 'glob';
import yargs from 'yargs';

import { generateVersionConfigs } from './generators/asdf';
import { generateEditorconfig } from './generators/editorconfig';
import { generateEslintignore } from './generators/eslintignore';
import { generateEslintrc } from './generators/eslintrc';
import { generateGitattributes } from './generators/gitattributes';
import { generateGitignore } from './generators/gitignore';
import { generateHuskyrc } from './generators/huskyrc';
import { generateIdeaSettings } from './generators/idea';
import { generateLintstagedrc } from './generators/lintstagedrc';
import { generatePackageJson } from './generators/packageJson';
import { generatePrettierignore } from './generators/prettierignore';
import { generateReleaserc } from './generators/releaserc';
import { generateRenovateJson } from './generators/renovaterc';
import { generateSemanticYml } from './generators/semanticRelease';
import { generateTsconfig } from './generators/tsconfig';
import { generateWorkflow } from './generators/workflow';
import { generateYarnrcYml } from './generators/yarnrc';
import { getPackageConfig, PackageConfig } from './utils/packageConfig';
import { promisePool } from './utils/promisePool';
import { spawnSync } from './utils/spawnUtil';

async function main(): Promise<void> {
  const argv = await yargs(process.argv.slice(2))
    .command('wbfy <paths...>', 'Generate/update project files for WillBooster')
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

    const rootConfig = await getPackageConfig(rootDirPath);
    if (rootConfig === null) {
      console.error(`there is no valid package.json in ${rootDirPath}`);
      continue;
    }

    const subDirPaths = rootConfig.containingSubPackageJsons
      ? glob.sync('packages/*', { cwd: rootDirPath }).map((subDirPath) => path.resolve(rootDirPath, subDirPath))
      : [];
    const subPackageConfigs = (await Promise.all(subDirPaths.map((subDirPath) => getPackageConfig(subDirPath)))).filter(
      (config) => !!config
    ) as PackageConfig[];
    const allPackageConfigs = [rootConfig, ...subPackageConfigs];
    const allNodePackageConfigs = [rootConfig, ...subPackageConfigs.filter((config) => config.containingPackageJson)];

    if (argv.verbose) {
      for (const config of allPackageConfigs) {
        console.log(config);
      }
    }

    const rootPromises = allPackageConfigs.map((config) => generateGitignore(config, rootConfig));
    // Install yarn berry at first
    await generateYarnrcYml(rootConfig);
    rootPromises.push(
      generateEditorconfig(rootConfig),
      generateGitattributes(rootConfig),
      generateHuskyrc(rootConfig),
      generateIdeaSettings(rootConfig),
      generateLintstagedrc(rootConfig),
      generateRenovateJson(rootConfig),
      generateReleaserc(rootConfig),
      generateSemanticYml(rootConfig),
      generateVersionConfigs(rootConfig),
      generateWorkflow(rootConfig)
    );
    await Promise.all(rootPromises);
    await promisePool.promiseAll();

    const promises: Promise<void>[] = [];
    for (const config of allNodePackageConfigs) {
      promises.push(generatePrettierignore(config), generateLintstagedrc(config));
      if (config.containingTypeScript || config.containingTypeScriptInPackages) {
        promises.push(generateTsconfig(config, rootConfig));
      }
      if (
        config.containingJavaScript ||
        config.containingJavaScriptInPackages ||
        config.containingTypeScript ||
        config.containingTypeScriptInPackages
      ) {
        if (!rootConfig.willBoosterConfigs) {
          promises.push(generateEslintrc(config, rootConfig));
        }
        promises.push(generateEslintignore(config));
      }
    }
    await Promise.all(promises);
    await promisePool.promiseAll();

    for (const config of allNodePackageConfigs) {
      await generatePackageJson(config, rootConfig, argv.skipDeps);
    }
    spawnSync('yarn', ['cleanup'], rootDirPath);
    // 'yarn install' should be after `yarn cleanup` because yarn berry generates yarn.lock
    // corresponding to the contents of dependant sub-package in monorepo
    spawnSync('yarn', ['install'], rootDirPath);

    try {
      const releasesPath = path.join(rootDirPath, '.yarn', 'releases');
      const yarnReleaseFiles = await fs.promises.readdir(releasesPath);
      console.log('.yarn/releases', yarnReleaseFiles);
    } catch (_) {
      // do nothing
    }
  }
}

main().then();
