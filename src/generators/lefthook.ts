import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';
import { spawnSync } from '../utils/spawnUtil.js';

import { generateScripts } from './packageJson.js';

interface LefthookSettings {
  'post-merge': {
    scripts: {
      'prepare.sh': {
        runner: 'bash';
      };
    };
  };
  'pre-commit': {
    commands: {
      cleanup: {
        glob: string;
        run: string;
      };
      'check-migrations': {
        glob: string;
        run: string;
      };
    };
  };
  'pre-push': {
    scripts: {
      'check.sh': {
        runner: 'bash';
      };
    };
  };
}

const baseSettings: Omit<LefthookSettings, 'pre-commit'> = {
  'post-merge': {
    scripts: {
      'prepare.sh': {
        runner: 'bash',
      },
    },
  },
  'pre-push': {
    scripts: {
      'check.sh': {
        runner: 'bash',
      },
    },
  },
};

const preCommitSettings = {
  commands: {
    cleanup: {
      glob: '*.{cjs,css,cts,htm,html,js,json,json5,jsonc,jsx,md,mjs,mts,scss,ts,tsx,vue,yaml,yml}',
      run: '__PM__ lint-staged',
    },
    'check-migrations': {
      glob: '**/migration.sql',
      run: `
if grep -q 'Warnings:' {staged_files}; then
  echo "Migration SQL files ({staged_files}) contain warnings! Please solve the warnings and commit again."
  exit 1
fi
`.trim(),
    },
  },
};

const packageManagerPlaceholder = '__PM__';
const typecheckPlaceholder = '__TYPECHECK__';

const scriptTemplates = {
  prePushForLab: `
#!/bin/bash

if [ $(git branch --show-current) = "main" ] && [ $(git config user.email) != "exkazuu@gmail.com" ]; then
  echo "************************************************"
  echo "*** Don't push main branch directly. Use PR! ***"
  echo "************************************************"
  exit 1
fi

${typecheckPlaceholder}
`.trim(),
  postMerge: `
#!/bin/bash

changed_files="$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)"

run_if_changed() {
  if echo "$changed_files" | grep --quiet -E "$1"; then
    eval "$2"
  fi
}
`.trim(),
};

export async function generateLefthookUpdatingPackageJson(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateLefthookUpdatingPackageJson', async () => {
    await core(config);
  });
}

async function core(config: PackageConfig): Promise<void> {
  const dirPath = path.resolve(config.dirPath, '.lefthook');
  const huskyDirPath = path.resolve(config.dirPath, '.husky');
  const hasHuskyDir = fs.existsSync(huskyDirPath);
  const { typecheck } = generateScripts(config, {});
  const packageManagerCommand = getPackageManagerCommand(config);
  const preCommitTemplate = getPreCommitTemplate(config);
  const prePushTemplate = getPrePushTemplate(config);
  const settings: Partial<LefthookSettings> = {
    ...baseSettings,
    'pre-commit': {
      ...preCommitSettings,
      commands: {
        ...preCommitSettings.commands,
        cleanup: {
          ...preCommitSettings.commands.cleanup,
          run: applyPackageManager(preCommitTemplate, packageManagerCommand),
        },
      },
    },
  };
  if (!typecheck) {
    delete settings['pre-push'];
  }
  await Promise.all([
    fs.promises.writeFile(
      path.join(config.dirPath, 'lefthook.yml'),
      yaml.dump(settings, {
        lineWidth: -1,
        noCompatMode: true,
        styles: {
          '!!null': 'empty',
        },
      })
    ),
    fs.promises.rm(dirPath, { force: true, recursive: true }),
  ]);
  if (hasHuskyDir) {
    await Promise.all([
      fs.promises.rm(huskyDirPath, { force: true, recursive: true }),
      fs.promises.rm(path.resolve(config.dirPath, '.huskyrc.json'), { force: true }),
    ]);
    spawnSync('git', ['config', '--unset', 'core.hooksPath'], config.dirPath);
  }

  if (typecheck) {
    const prePushContent = config.repository?.startsWith('github:WillBoosterLab/')
      ? scriptTemplates.prePushForLab.replace(typecheckPlaceholder, prePushTemplate)
      : prePushTemplate;
    const prePush = applyPackageManager(prePushContent, packageManagerCommand);
    fs.mkdirSync(path.join(dirPath, 'pre-push'), { recursive: true });
    await promisePool.run(() =>
      fs.promises.writeFile(path.join(dirPath, 'pre-push', 'check.sh'), prePush + '\n', {
        mode: 0o755,
      })
    );
  }
  const postMergeCommand = `${scriptTemplates.postMerge}\n\n${generatePostMergeCommands(config).join('\n')}\n`;
  fs.mkdirSync(path.join(dirPath, 'post-merge'), { recursive: true });
  await promisePool.run(() =>
    fs.promises.writeFile(path.resolve(dirPath, 'post-merge', 'prepare.sh'), postMergeCommand, {
      mode: 0o755,
    })
  );
}

function generatePostMergeCommands(config: PackageConfig): string[] {
  const postMergeCommands: string[] = [];
  if (config.hasVersionSettings) {
    const toolsChangedPattern = String.raw`(mise\.toml|\.mise\.toml|\.tool-versions|\..+-version)`;
    postMergeCommands.push(String.raw`run_if_changed "${toolsChangedPattern}" "mise install"`);
  }
  const installCommand = config.isBun ? 'bun install' : 'yarn';
  const rmNextDirectory = config.depending.blitz || config.depending.next ? ' && rm -Rf .next' : '';
  postMergeCommands.push(String.raw`run_if_changed "package\.json" "${installCommand}${rmNextDirectory}"`);
  if (config.doesContainPoetryLock) {
    postMergeCommands.push(String.raw`run_if_changed "poetry\.lock" "poetry install"`);
  }
  if (config.depending.blitz) {
    postMergeCommands.push(
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/blitz prisma migrate deploy"`,
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/blitz prisma generate"`,
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/blitz codegen"`
    );
  } else if (config.depending.prisma) {
    postMergeCommands.push(
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/dotenv -c development -- node node_modules/.bin/prisma migrate deploy"`,
      String.raw`run_if_changed ".*\.prisma" "node node_modules/.bin/dotenv -c development -- node node_modules/.bin/prisma generate"`
    );
  }
  return postMergeCommands;
}

function getPackageManagerCommand(config: PackageConfig): string {
  return config.isBun ? 'bun --bun' : 'yarn';
}

function getPreCommitTemplate(config: PackageConfig): string {
  return config.isBun
    ? `${packageManagerPlaceholder} wb lint --fix --format {staged_files} && git add {staged_files}`
    : preCommitSettings.commands.cleanup.run;
}

function getPrePushTemplate(config: PackageConfig): string {
  return config.isBun
    ? `${packageManagerPlaceholder} node_modules/.bin/wb typecheck`
    : `${packageManagerPlaceholder} typecheck`;
}

function applyPackageManager(template: string, packageManagerCommand: string): string {
  return template.replaceAll(packageManagerPlaceholder, packageManagerCommand);
}
