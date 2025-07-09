import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import yaml from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { overwriteMerge } from '../utils/mergeUtil.js';
import { promisePool } from '../utils/promisePool.js';

const defaultConfig = {
  have_fun: true,
  code_review: {
    disable: false,
    comment_severity_threshold: 'MEDIUM',
    max_review_comments: -1,
    pull_request_opened: {
      help: false,
      summary: true,
      code_review: true,
    },
  },
  ignore_patterns: ['**/__generated__'],
};

export async function generateGeminiConfig(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateGeminiConfig', async () => {
    if (!config.isRoot) return;

    const dirPath = path.resolve(config.dirPath, '.gemini');
    const configFilePath = path.resolve(dirPath, 'config.yml');
    const styleguideFilePath = path.resolve(dirPath, 'styleguide.md');

    let newConfig: object = cloneDeep(defaultConfig);
    try {
      const oldContent = await fs.promises.readFile(configFilePath, 'utf8');
      const oldConfig = yaml.load(oldContent) as object;
      newConfig = merge.all([newConfig, oldConfig, newConfig], { arrayMerge: overwriteMerge });
    } catch {
      // do nothing - file doesn't exist or can't be parsed
    }

    const yamlContent = yaml.dump(newConfig, {
      lineWidth: -1,
      noCompatMode: true,
      styles: {
        '!!null': 'empty',
      },
    });

    const styleguideContent = '日本語でレビューしてください。';

    await Promise.all([
      promisePool.run(() => fsUtil.generateFile(configFilePath, yamlContent)),
      promisePool.run(() => fsUtil.generateFile(styleguideFilePath, styleguideContent)),
    ]);
  });
}
