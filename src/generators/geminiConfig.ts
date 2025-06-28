import path from 'node:path';

import yaml from 'js-yaml';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
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

    const yamlContent = yaml.dump(defaultConfig, {
      lineWidth: -1,
      noCompatMode: true,
      styles: {
        '!!null': 'empty',
      },
    });

    const styleguideContent = '日本語で回答してください。';

    await Promise.all([
      promisePool.run(() => fsUtil.generateFile(configFilePath, yamlContent)),
      promisePool.run(() => fsUtil.generateFile(styleguideFilePath, styleguideContent)),
    ]);
  });
}
