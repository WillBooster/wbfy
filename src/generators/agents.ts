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
