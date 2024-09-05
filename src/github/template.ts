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

- [ ] I've confirmed \`All checks have passed\` on this page. （このページで \`All checks have passed\` が表示されていることを確認した。）
  - You may leave this box unchecked due to long workflows.
  - PR title follows [Angular's commit message format](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#-commit-message-format).
    - PR title doesn't have \`WIP:\`.
  - All tests are passed.
    - Test command (e.g., \`yarn test\`) is passed.
    - Lint command (e.g., \`yarn lint\`) is passed.
- [ ] I've reviewed my changes on GitHub PR's diff view. （GitHub上で自分の変更内容を確認した。）
- [ ] I've written the steps to test. （テスト手順を記載した。）
- [ ] I've added screenshots. （UIを変更した場合、スクリーンショットを追加した。）
  - You may leave this box unchecked if you didn't modify the UI.

<!-- Please add screenshots if you modify the UI.
| Current                  | In coming                |
| ------------------------ | ------------------------ |
| <img src="" width="400"> | <img src="" width="400"> |
-->

## Steps to Test

1. Open http://localhost-exercode.willbooster.net:3000/ja-JP/courses/_example/lessons/_example_a_plus_b/problems/_example_a_plus_b after login.
2. Select the language \`C\`.
3. Write the following code:
   \`\`\`c
   #include <stdio.h>

   int main(void) {
     int a, b;

     scanf("%d %d", &a, &b);
     printf("%d", a + b);
     return 0;
   }
   \`\`\`
4. Push \`Submit\` button.
5. ...

<!-- 日本語で記述しても大丈夫です。 -->
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

      await fs.promises.mkdir(path.resolve(config.dirPath, '.github'), { recursive: true });
      await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
    }
  });
}
