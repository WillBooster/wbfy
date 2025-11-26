import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { promisePool } from '../utils/promisePool.js';

import { generatePostMergeCommands } from './huskyrc.js';
import { generateScripts } from './packageJson.js';

const newSettings = {
  'post-merge': {
    scripts: {
      'prepare.sh': {
        runner: 'bash',
      },
    },
  },
  'pre-commit': {
    commands: {
      cleanup: {
        glob: '*.{cjs,css,cts,htm,html,js,json,json5,jsonc,jsx,md,mjs,mts,scss,ts,tsx,vue,yaml,yml}',
        run: 'bun --bun wb lint --fix --format {staged_files} && git add {staged_files}',
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
  },
  'pre-push': {
    scripts: {
      'check.sh': {
        runner: 'bash',
      },
    },
  },
};

const scripts = {
  prePush: `bun --bun node_modules/.bin/wb typecheck`,
  prePushForLab: `
#!/bin/bash

if [ $(git branch --show-current) = "main" ] && [ $(git config user.email) != "exkazuu@gmail.com" ]; then
  echo "************************************************"
  echo "*** Don't push main branch directly. Use PR! ***"
  echo "************************************************"
  exit 1
fi

bun --bun node_modules/.bin/wb typecheck
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
  const { typecheck } = generateScripts(config, {});
  const settings: Partial<typeof newSettings> = { ...newSettings };
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

  if (typecheck) {
    const prePush = config.repository?.startsWith('github:WillBoosterLab/') ? scripts.prePushForLab : scripts.prePush;
    fs.mkdirSync(path.join(dirPath, 'pre-push'), { recursive: true });
    await promisePool.run(() =>
      fs.promises.writeFile(path.join(dirPath, 'pre-push', 'check.sh'), prePush + '\n', {
        mode: 0o755,
      })
    );
  }
  const postMergeCommand = `${scripts.postMerge}\n\n${generatePostMergeCommands(config).join('\n')}\n`;
  fs.mkdirSync(path.join(dirPath, 'post-merge'), { recursive: true });
  await promisePool.run(() =>
    fs.promises.writeFile(path.resolve(dirPath, 'post-merge', 'prepare.sh'), postMergeCommand, {
      mode: 0o755,
    })
  );
}
