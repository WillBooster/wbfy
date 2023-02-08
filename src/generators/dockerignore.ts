import path from 'node:path';

import { logger } from '../logger.js';
import { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { ignoreFileUtil } from '../utils/ignoreFileUtil.js';
import { promisePool } from '../utils/promisePool.js';

const commonContent = `
**/*.sqlite3*
`;

export async function generateDockerignore(config: PackageConfig): Promise<void> {
  return logger.function('generateDockerignore', async () => {
    const filePath = path.resolve(config.dirPath, '.dockerignore');
    const content = (await fsUtil.readFileIgnoringError(filePath)) ?? '';
    const headUserContent = ignoreFileUtil.getHeadUserContent(content);
    const tailUserContent = ignoreFileUtil.getTailUserContent(content);

    const newContent = headUserContent + commonContent + tailUserContent;
    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}
