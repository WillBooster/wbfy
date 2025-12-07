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
- Package Manager: ${packageManager}

## General Instructions

${
  allConfigs.some((c) => c.depending.genI18nTs)
    ? `- When introducing new string literals in React components, update the language resource files in the \`i18n\` directory (e.g., \`i18n/ja-JP.json\`). Reference these strings using the \`i18n\` utility. For example, use \`i18n.pages.home.title()\` for \`{ "pages": { "home": { "title": "My App" } } }\`.`
    : ''
}
- Do not write tests unless explicitly requested.
- After making code changes, run \`${packageManager} check-all-for-ai\` to execute all tests (note: this may take up to 30 minutes), or run \`${packageManager} check-for-ai\` for type checking and linting only.
  - If you are confident your changes will not break any tests, you may use \`check-for-ai\`.
- Once you have verified your changes, commit them to the non-main branch using the \`--no-verify\` option and push to the current branch.
  - Follow conventional commits, i.e., your commit message should start with \`feat:\`, \`fix:\`, etc.
  - Make sure to add a new line at the end of your commit message${rootConfig.isWillBoosterRepo ? ` with: \`Co-authored-by: WillBooster (${toolName}) <agent@willbooster.com>\`` : ''}.
  - Always create new commits. Avoid using \`--amend\`.
${
  allConfigs.some((c) => c.hasStartTest)
    ? `- Use \`${packageManager} run start-test\` to launch a web server for debugging or testing.`
    : ''
}

## Coding Style

- Write comments that explain "why" rather than "what". Avoid explanations that can be understood from the code itself.
- Use stderr for logging debug messages temporarily since stdout output is sometimes omitted.
- When adding new functions or classes, define them below any functions or classes that call them to maintain clear call order.
- Prefer \`undefined\` over \`null\` unless explicitly dealing with APIs or libraries that require \`null\`.
- Always perform existence checks on array due to \`noUncheckedIndexedAccess: true\`.
${
  allConfigs.some((c) => c.depending.react || c.depending.next)
    ? `- Prefer \`useImmer\` for storing an array or an object to \`useState\`.`
    : ''
}
${
  allConfigs.some((c) => c.depending.next)
    ? `- Since this project uses the React Compiler, you do not need to use \`useCallback\` or \`useMemo\` for performance optimization.`
    : ''
}
`
    .replaceAll(/\.\n\n+-/g, '.\n-')
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
