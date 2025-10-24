import path from 'node:path';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

export async function generateAgentInstructions(config: PackageConfig, allConfigs: PackageConfig[]): Promise<void> {
  return logger.functionIgnoringException('generateAgentInstructions', async () => {
    if (!config.isRoot) return;

    // Check if AGENTS_EXTRA.md exists and read its content
    const agentsExtraPath = path.resolve(config.dirPath, 'AGENTS_EXTRA.md');
    const extraContent = await fsUtil.readFileIgnoringError(agentsExtraPath);

    for (const [fileName, toolName] of [
      ['AGENTS.md', 'Codex CLI'],
      ['CLAUDE.md', 'Claude Code'],
      ['GEMINI.md', 'Gemini CLI'],
    ] as const) {
      const content = generateAgentInstruction(config, allConfigs, toolName, extraContent);
      const filePath = path.resolve(config.dirPath, fileName);
      await promisePool.run(() => fsUtil.generateFile(filePath, content));
    }

    const cursorRulesPath = path.resolve(config.dirPath, '.cursor/rules/general.mdc');
    const cursorRulesContent = generateCursorGeneralMdcContent(config, allConfigs, extraContent);
    await promisePool.run(() => fsUtil.generateFile(cursorRulesPath, cursorRulesContent));
  });
}

function generateAgentInstruction(
  config: PackageConfig,
  allConfigs: PackageConfig[],
  toolName: string,
  extraContent?: string
): string {
  const packageManager = config.isBun ? 'bun' : 'yarn';
  const baseContent = `
## Project Information

- Name: ${config.packageJson?.name}
- Description: ${config.packageJson?.description}
- Package Manager: ${packageManager}

## General Instructions

${
  allConfigs.some((c) => c.depending.genI18nTs)
    ? `- When introducing new string literals in React components, update the language resource files in the \`i18n\` directory (e.g., \`i18n/ja-JP.json\`). Reference these strings using the \`i18n\` utility. For example, use \`i18n.pages.home.title()\` for \`{ "pages": { "home": { "title": "My App" } } }\`.`
    : ''
}
- After making code changes, run \`${packageManager} check-all-for-ai\` to execute all tests (note: this may take up to 30 minutes), or run \`${packageManager} check-for-ai\` for type checking and linting only.
  - If you are confident your changes will not break any tests, you may use \`check-for-ai\`.
- Once you have verified your changes, commit them to the current branch using the \`--no-verify\` option and push to the current branch.
  - Follow conventional commits, i.e., your commit message should start with \`feat:\`, \`fix:\`, etc.
  - Make sure to add a new line at the end of your commit message with: \`Co-authored-by: WillBooster (${toolName}) <agent@willbooster.com>\`.
  - Always create new commits. Avoid using \`--amend\`.
${
  allConfigs.some((c) => c.hasStartTest)
    ? `- Use \`${packageManager} run start-test\` to launch a web server for debugging or testing.`
    : ''
}

## Coding Style

- Write comments that explain "why" rather than "what". Avoid explanations that can be understood from the code itself.
- When adding new functions or classes, define them below any functions or classes that call them to maintain clear call order.
${
  allConfigs.some((c) => c.depending.next)
    ? `- Since this project uses the React Compiler, you do not need to use \`useCallback\` or \`useMemo\` for performance optimization.`
    : ''
}
`
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();

  return extraContent ? baseContent + '\n' + extraContent.trimEnd() : baseContent;
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
