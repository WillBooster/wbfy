import fs from 'node:fs';
import path from 'node:path';

import { distance } from 'fastest-levenshtein';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

const templates = {
  'pull_request_template.md': `
Close #<IssueNumber>

## Self Check

- [ ] I've confirmed \`All checks have passed\` on PR page. (You may leave this box unchecked due to long workflows.)
  - PR title follows [Angular's commit message format](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#-commit-message-format).
    - PR title doesn't have \`WIP:\`.
  - All tests are passed.
    - Test command (e.g., \`yarn test\`) is passed.
    - Lint command (e.g., \`yarn lint\`) is passed.
- [ ] I've reviewed my changes on PR's diff view.

<!-- Please add screenshots if you modify the UI. Otherwise, remove the following table. -->
| Current                  | In coming                |
| ------------------------ | ------------------------ |
| <img src="" width="400"> | <img src="" width="400"> |
`.trim(),
};

export async function generateGitHubTemplates(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('generateGitHubTemplates', async () => {
    for (const [fileName, newContent] of Object.entries(templates)) {
      const filePath = path.resolve(config.dirPath, '.github', fileName);
      if (fs.existsSync(filePath)) {
        const oldContent = await fs.promises.readFile(filePath, 'utf8');
        if (distance(oldContent, newContent) > newContent.length / 2) {
          continue;
        }
      }

      await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
    }
  });
}
