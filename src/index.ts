import fs from 'node:fs/promises';
import path from 'node:path';

import { ignoreErrorAsync } from '@willbooster/shared-lib';
import yargs from 'yargs';

import { fixDockerfile } from './fixers/dockerfile.js';
import { fixPlaywrightConfig } from './fixers/playwrightConfig.js';
import { fixPrismaEnvFiles } from './fixers/prisma.js';
import { fixTestDirectoriesUpdatingPackageJson } from './fixers/testDirectory.js';
import { fixTypeDefinitions } from './fixers/typeDefinition.js';
import { fixTypos } from './fixers/typos.js';
import { generateToolVersions } from './generators/asdf.js';
import { generateBiomeJsonc } from './generators/biome.js';
import { generateBunfigToml } from './generators/bunfig.js';
import { generateDockerignore } from './generators/dockerignore.js';
import { generateEditorconfig } from './generators/editorconfig.js';
import { generateEslintignore } from './generators/eslintignore.js';
import { generateEslintrc } from './generators/eslintrc.js';
import { generateGitattributes } from './generators/gitattributes.js';
import { generateGitignore } from './generators/gitignore.js';
import { generateHuskyrcUpdatingPackageJson } from './generators/huskyrc.js';
import { generateIdeaSettings } from './generators/idea.js';
import { generateLefthookUpdatingPackageJson } from './generators/lefthook.js';
import { generateLintstagedrc } from './generators/lintstagedrc.js';
import { generateNextConfigJson } from './generators/nextconfig.js';
import { generatePackageJson } from './generators/packageJson.js';
import { generatePrettierignore } from './generators/prettierignore.js';
import { generatePyrightConfigJson } from './generators/pyrightconfig.js';
import { generateReadme } from './generators/readme.js';
import { generateReleaserc } from './generators/releaserc.js';
import { generateRenovateJson } from './generators/renovaterc.js';
import { generateTsconfig } from './generators/tsconfig.js';
import { generateVscodeSettings } from './generators/vscodeSettings.js';
import { generateWorkflows } from './generators/workflow.js';
import { generateYarnrcYml } from './generators/yarnrc.js';
import { setupLabels } from './github/label.js';
import { setupSecrets } from './github/secret.js';
import { setupGitHubSettings } from './github/settings.js';
import { generateGitHubTemplates } from './github/template.js';
import { options } from './options.js';
import type { PackageConfig } from './packageConfig.js';
import { getPackageConfig } from './packageConfig.js';
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
      env: {
        description: 'Upload environment variables as secrets to GitHub',
        type: 'boolean',
        default: false,
        alias: 'e',
      },
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
  options.doesUploadEnvVars = argv.env;

  for (const rootDirPath of argv.paths as string[]) {
    const packagesDirPath = path.join(rootDirPath, 'packages');
    const dirents = (await ignoreErrorAsync(() => fs.readdir(packagesDirPath, { withFileTypes: true }))) ?? [];
    const subDirPaths = dirents.filter((d) => d.isDirectory()).map((d) => path.join(packagesDirPath, d.name));

    await fixTestDirectoriesUpdatingPackageJson([rootDirPath, ...subDirPaths]);

    const rootConfig = await getPackageConfig(rootDirPath);
    if (!rootConfig) {
      console.error(`there is no valid package.json in ${rootDirPath}`);
      continue;
    }
    const abbreviationPromise = fixTypos(rootConfig);

    const nullableSubPackageConfigs = await Promise.all(
      subDirPaths.map((subDirPath) => getPackageConfig(subDirPath, rootConfig))
    );
    const subPackageConfigs = nullableSubPackageConfigs.filter((config) => !!config) as PackageConfig[];
    const allPackageConfigs = [rootConfig, ...subPackageConfigs];

    if (options.isVerbose) {
      for (const config of allPackageConfigs) {
        console.info(config);
      }
    }

    // Install tools via asdf at first
    await generateToolVersions(rootConfig);
    // Install yarn berry
    await generateYarnrcYml(rootConfig);
    await Promise.all([
      fixDockerfile(rootConfig),
      fixPrismaEnvFiles(rootConfig),
      abbreviationPromise.then(() => generateReadme(rootConfig)),
      generateDockerignore(rootConfig),
      generateEditorconfig(rootConfig),
      generateGitattributes(rootConfig),
      generateGitHubTemplates(rootConfig),
      generateIdeaSettings(rootConfig),
      generateRenovateJson(rootConfig),
      generateReleaserc(rootConfig),
      generateWorkflows(rootConfig),
      setupLabels(rootConfig),
      setupSecrets(rootConfig),
      setupGitHubSettings(rootConfig),
      ...(rootConfig.isBun
        ? [
            generateBunfigToml(rootConfig),
            generateHuskyrcUpdatingPackageJson(rootConfig).then(() => generateLefthookUpdatingPackageJson(rootConfig)),
          ]
        : [generateHuskyrcUpdatingPackageJson(rootConfig)]),
      generateLintstagedrc(rootConfig),
    ]);
    await promisePool.promiseAll();

    const promises: Promise<void>[] = [];
    for (const config of allPackageConfigs) {
      if (config.doesContainsTypeScript || config.doesContainsTypeScriptInPackages) {
        promises.push(fixTypeDefinitions(config, config.isRoot ? allPackageConfigs : [config]));
      }
      if (config.depending.playwrightTest) {
        promises.push(fixPlaywrightConfig(config));
      }
      if (config.depending.next) {
        promises.push(generateNextConfigJson(config));
      }
      await generateGitignore(config, rootConfig);
      await promisePool.promiseAll();
      if (!config.isRoot && !config.doesContainsPackageJson) {
        continue;
      }
      await generatePrettierignore(config);
      await generatePackageJson(config, rootConfig, argv.skipDeps);

      promises.push(generateLintstagedrc(config));
      if (config.doesContainsVscodeSettingsJson && config.doesContainsPackageJson) {
        promises.push(generateVscodeSettings(config));
      }
      if (config.doesContainsTypeScript || config.doesContainsTypeScriptInPackages) {
        promises.push(generateTsconfig(config));
      }
      if (
        config.doesContainsJavaScript ||
        config.doesContainsJavaScriptInPackages ||
        config.doesContainsTypeScript ||
        config.doesContainsTypeScriptInPackages
      ) {
        if (rootConfig.isBun) {
          promises.push(generateBiomeJsonc(config));
        }
        if (!rootConfig.isWillBoosterConfigs) {
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

    const packageManager = rootConfig.isBun ? 'bun' : 'yarn';
    spawnSync(packageManager, ['cleanup'], rootDirPath);
    // 'yarn install' should be after `yarn cleanup` because yarn berry generates yarn.lock
    // corresponding to the contents of dependant sub-package in monorepo
    spawnSync(packageManager, ['install'], rootDirPath);
  }
}

await main();
