import fs from 'node:fs/promises';
import path from 'node:path';

import { ignoreErrorAsync } from '@willbooster/shared-lib';
import yargs from 'yargs';

import { fixAbbreviations } from './fixers/abbreviations.js';
import { fixDockerfile } from './fixers/dockerfile.js';
import { fixTestDirectories } from './fixers/testDirectory.js';
import { fixTypeDefinitions } from './fixers/typeDefinition.js';
import { generateVersionConfigs } from './generators/asdf.js';
import { generateDockerignore } from './generators/dockerignore.js';
import { generateEditorconfig } from './generators/editorconfig.js';
import { generateEslintignore } from './generators/eslintignore.js';
import { generateEslintrc } from './generators/eslintrc.js';
import { generateGitattributes } from './generators/gitattributes.js';
import { generateGitignore } from './generators/gitignore.js';
import { generateHuskyrc } from './generators/huskyrc.js';
import { generateIdeaSettings } from './generators/idea.js';
import { generateLintstagedrc } from './generators/lintstagedrc.js';
import { generatePackageJson } from './generators/packageJson.js';
import { generatePrettierignore } from './generators/prettierignore.js';
import { generatePyrightConfigJson } from './generators/pyrightconfig.js';
import { generateReadme } from './generators/readme.js';
import { generateReleaserc } from './generators/releaserc.js';
import { generateRenovateJson } from './generators/renovaterc.js';
import { generateTsconfig } from './generators/tsconfig.js';
import { generateWorkflows } from './generators/workflow.js';
import { generateYarnrcYml } from './generators/yarnrc.js';
import { setupLabels } from './github/label.js';
import { setupSecrets } from './github/secret.js';
import { setupSettings } from './github/settings.js';
import { options } from './options.js';
import { getPackageConfig, PackageConfig } from './packageConfig.js';
import { promisePool } from './utils/promisePool.js';
import { spawnSync } from './utils/spawnUtil.js';

async function main(): Promise<void> {
  const argv = await yargs(process.argv.slice(2))
    .command('$0 [paths..]', 'Make a given project follow the WillBooster standard', (yargs) => {
      yargs.positional('paths', {
        describe: 'project paths to be wbfied',
        array: true,
        type: 'string',
        default: ['.'],
      });
    })
    .options({
      skipDeps: {
        description: 'Skip dependency installation',
        type: 'boolean',
        default: false,
        alias: 'd',
      },
      verbose: {
        description: 'Whether or not to enable verbose mode',
        type: 'boolean',
        default: false,
        alias: 'v',
      },
    })
    .strict().argv;
  options.isVerbose = argv.verbose;

  for (const rootDirPath of argv.paths as string[]) {
    const packagesDirPath = path.join(rootDirPath, 'packages');
    const dirents = (await ignoreErrorAsync(() => fs.readdir(packagesDirPath, { withFileTypes: true }))) ?? [];
    const subDirPaths = dirents.filter((d) => d.isDirectory()).map((d) => path.join(packagesDirPath, d.name));

    await fixTestDirectories([rootDirPath, ...subDirPaths]);
    const abbreviationPromise = fixAbbreviations(rootDirPath);

    const rootConfig = await getPackageConfig(rootDirPath);
    if (!rootConfig) {
      console.error(`there is no valid package.json in ${rootDirPath}`);
      continue;
    }

    const nullableSubPackageConfigs = await Promise.all(subDirPaths.map((subDirPath) => getPackageConfig(subDirPath)));
    const subPackageConfigs = nullableSubPackageConfigs.filter((config) => !!config) as PackageConfig[];
    const allPackageConfigs = [rootConfig, ...subPackageConfigs];

    if (options.isVerbose) {
      for (const config of allPackageConfigs) {
        console.info(config);
      }
    }

    // Install tools via asdf at first
    await generateVersionConfigs(rootConfig);
    // Install yarn berry
    await generateYarnrcYml(rootConfig);
    await Promise.all([
      fixDockerfile(rootConfig),
      abbreviationPromise.then(() => generateReadme(rootConfig)),
      generateDockerignore(rootConfig),
      generateEditorconfig(rootConfig),
      generateGitattributes(rootConfig),
      generateHuskyrc(rootConfig),
      generateIdeaSettings(rootConfig),
      generateLintstagedrc(rootConfig),
      generateRenovateJson(rootConfig),
      generateReleaserc(rootConfig),
      generateWorkflows(rootConfig),
      setupLabels(rootConfig),
      setupSecrets(rootConfig),
      setupSettings(rootConfig),
    ]);
    await promisePool.promiseAll();

    const promises: Promise<void>[] = [];
    for (const config of allPackageConfigs) {
      if (config.containingTypeScript || config.containingTypeScriptInPackages) {
        promises.push(fixTypeDefinitions(config, config.root ? allPackageConfigs : [config]));
      }
      await generateGitignore(config, rootConfig);
      await promisePool.promiseAll();
      if (!config.root && !config.containingPackageJson) {
        continue;
      }
      await generatePrettierignore(config);
      await generatePackageJson(config, rootConfig, argv.skipDeps);

      promises.push(generateLintstagedrc(config));
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
      if (config.depending.pyright) {
        promises.push(generatePyrightConfigJson(config));
      }
    }
    await Promise.all(promises);
    await promisePool.promiseAll();

    spawnSync('yarn', ['cleanup'], rootDirPath);
    // 'yarn install' should be after `yarn cleanup` because yarn berry generates yarn.lock
    // corresponding to the contents of dependant sub-package in monorepo
    spawnSync('yarn', ['install'], rootDirPath);
  }
}

await main();
