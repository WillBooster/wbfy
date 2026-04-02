import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { spawnSync } from '../utils/spawnUtil.js';

const targetAgents = ['claude-code', 'codex', 'cursor', 'gemini-cli'];
const skillsRepo = 'WillBooster/agent-skills';

export async function installAgentSkills(rootConfig: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('installAgentSkills', async () => {
    runInstallAgentSkills(rootConfig);
    await Promise.resolve();
  });
}

function isWebAppRelated(config: PackageConfig): boolean {
  return (
    config.depending.next ||
    config.depending.playwrightTest ||
    config.depending.react ||
    config.depending.storybook ||
    config.doesContainJsxOrTsx ||
    config.doesContainJsxOrTsxInPackages
  );
}

function runInstallAgentSkills(rootConfig: PackageConfig): void {
  if (!rootConfig.isRoot) return;

  const commonArgs = [
    'skills@latest',
    'add',
    skillsRepo,
    ...targetAgents.flatMap((agent) => ['--agent', agent]),
    '--skill',
    '*',
    '--yes',
  ];
  spawnSync('npx', commonArgs, rootConfig.dirPath);

  if (isWebAppRelated(rootConfig)) return;

  spawnSync(
    'npx',
    ['skills@latest', 'remove', 'playwright-cli', ...targetAgents.flatMap((agent) => ['--agent', agent]), '--yes'],
    rootConfig.dirPath
  );
}
