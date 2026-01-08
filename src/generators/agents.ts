import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

export async function generateAgentInstructions(rootConfig: PackageConfig, allConfigs: PackageConfig[]): Promise<void> {
  return logger.functionIgnoringException('generateAgentInstructions', async () => {
    if (!rootConfig.isRoot) return;

    // Check if AGENTS_EXTRA.md exists and read its content
    const agentsExtraPath = path.resolve(rootConfig.dirPath, 'AGENTS_EXTRA.md');
    const extraContent = await fsUtil.readFileIgnoringError(agentsExtraPath);

    for (const [fileName, toolName] of [
      ['AGENTS.md', 'Codex CLI'],
      ['CLAUDE.md', 'Claude Code'],
      ['GEMINI.md', 'Gemini CLI'],
    ] as const) {
      const content = generateAgentInstruction(rootConfig, allConfigs, toolName, extraContent);
      const filePath = path.resolve(rootConfig.dirPath, fileName);
      await promisePool.run(() => fsUtil.generateFile(filePath, content));
    }

    const cursorRulesPath = path.resolve(rootConfig.dirPath, '.cursor/rules/general.mdc');
    const cursorRulesContent = generateCursorGeneralMdcContent(rootConfig, allConfigs, extraContent);
    await promisePool.run(() => fsUtil.generateFile(cursorRulesPath, cursorRulesContent));
  });
}

function generateAgentInstruction(
  rootConfig: PackageConfig,
  allConfigs: PackageConfig[],
  toolName: string,
  extraContent?: string
): string {
  const packageManager = rootConfig.isBun ? 'bun' : 'yarn';
  const baseContent = `
## Project Information

- Name: ${rootConfig.packageJson?.name}
- Description: ${rootConfig.packageJson?.description}
- Package Manager: ${packageManager} on zsh

## Development Workflow

When changing code, complete these steps before responding to the user.

1. If the current branch is \`main\`, create a new branch.
   - Include unexpected changes since they are mine.
2. Make code changes as needed.
3. If possible, write e2e tests for your changes.
4. Fix your changes until \`${packageManager} check-all-for-ai\` (running all tests, taking 30 mins) or \`${packageManager} check-for-ai\` (only type checking and linting) passes.
   - If you are confident your changes will not break any tests, you may use \`check-for-ai\`.
5. Commit your changes to the current branch and push.
   - Follow conventional commits, i.e., your commit message should start with \`feat:\`, \`fix:\`, \`test:\`, etc.
   - Make sure to add a new line at the end of your commit message${rootConfig.isWillBoosterRepo ? ` with: \`Co-authored-by: WillBooster (${toolName}) <agent@willbooster.com>\`` : ''}.
   - When pre-commit hooks prevent your changes, fix your code, then re-commit and re-push.
6. Create a pull request using \`gh\`.
   - The pull request title should match your commit message.
7. Repeat the following steps until the test workflow passes:
   1. Monitor the CI results using the following command until the test workflow completes (timeout should be 30 mins).
      - \`while :; do gh run list -b "$(git branch --show-current)" --json status,conclusion | jq -e '.[] | select(.conclusion=="failure")' && exit 1; gh run list -b "$(git branch --show-current)" --json status | jq -e '.[] | select(.status=="completed" | not)' || exit 0; sleep 1m; done\`
   2. If tests fail, identify the root causes by gathering debug information through logging and screenshots, then fix the code and/or tests.
   3. Fetch unresolved review comments from the pull request using the following command. Address them and then mark them as resolved.
      - \`gh api graphql -f query="{ repository(owner: \\"${rootConfig.repoAuthor || 'WillBooster'}\\", name: \\"${rootConfig.repoName || 'wbfy'}\\") { pullRequest(number: $(gh pr view --json number -q .number)) { reviewThreads(first: 100) { nodes { isResolved comments(first: 100) { nodes { body author { login } path line } } } } } } }" | jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'\`
   4. Commit your changes and push.
   5. Write \`/gemini review\` in the pull request.

${generateAgentCodingStyle(allConfigs)}
`
    .replaceAll(/\.\n\n+-/g, '.\n-')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();

  return extraContent ? baseContent + '\n' + extraContent.trimEnd() : baseContent;
}

export function generateAgentCodingStyle(allConfigs: PackageConfig[]): string {
  return `
## Coding Style

- Design each module with high cohesion, ensuring related functionality is grouped together.
- Create understandable directory structures with low coupling and high cohesion.
- When adding new functions or classes, define them below any functions or classes that call them to maintain a clear call order.
- Write comments that explain "why" rather than "what". Avoid explanations that can be understood from the code itself.
- Prefer \`undefined\` over \`null\` unless explicitly dealing with APIs or libraries that require \`null\`.
${
  allConfigs.some((c) => c.depending.genI18nTs)
    ? `- When introducing new string literals in React components, update the language resource files in the \`i18n\` directory (e.g., \`i18n/ja-JP.json\`). Reference these strings using the \`i18n\` utility. For example, use \`i18n.pages.home.title()\` for \`{ "pages": { "home": { "title": "My App" } } }\`.`
    : ''
}
${
  allConfigs.some((c) => c.depending.react || c.depending.next)
    ? `- Prefer \`useImmer\` for storing an array or an object to \`useState\`.`
    : ''
}
${
  allConfigs.some((c) => c.depending.next)
    ? `
- Since this project uses the React Compiler, you do not need to use \`useCallback\` or \`useMemo\` for performance optimization.
- Assume there is only a single server instance.
`
    : ''
}
`
    .replaceAll(/\.\n\n+-/g, '.\n-')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

function generateCursorGeneralMdcContent(
  config: PackageConfig,
  allConfigs: PackageConfig[],
  extraContent?: string
): string {
  const frontmatter = `---\ndescription: General Coding Rules\nglobs:\nalwaysApply: true\n---`;
  const body = generateAgentInstruction(config, allConfigs, 'Cursor', extraContent);
  return `${frontmatter}\n\n${body}`;
}
