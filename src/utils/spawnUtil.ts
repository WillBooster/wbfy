import type { SpawnSyncOptions } from 'node:child_process';
import child_process from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Avoid repeating the same install when multiple commands run in a row.
let installedLtsNodejs = false;
const toolVersionsCache = new Map<string, string | undefined>();

export function spawnSync(command: string, args: string[], cwd: string, retry = 0): void {
  do {
    const [newCmd, newArgs, options] = getSpawnSyncArgs(command, args, cwd);
    console.log(`$ ${newCmd} ${newArgs.join(' ')} at ${cwd}`);
    const ret = child_process.spawnSync(newCmd, newArgs, options);
    if (ret.status === 0) break;
  } while (--retry >= 0);
}

export function spawnSyncAndReturnStdout(command: string, args: string[], cwd: string): string {
  const [newCmd, newArgs, options] = getSpawnSyncArgs(command, args, cwd);
  options.stdio = 'pipe';
  const proc = child_process.spawnSync(newCmd, newArgs, options);
  const error = proc.stderr.toString().trim();
  if (error) {
    console.error(
      `${newCmd} [${newArgs.map((s) => `"${s}"`).join(', ')}] outputs the following content to stderr:\n${error}`
    );
  }
  return proc.stdout.toString().trim();
}

export function getSpawnSyncArgs(command: string, args: string[], cwd: string): [string, string[], SpawnSyncOptions] {
  const env = { ...process.env };
  // Remove berry from PATH
  if (env.PATH && env.BERRY_BIN_FOLDER) {
    env.PATH = env.PATH.replace(`${env.BERRY_BIN_FOLDER}:`, '');
  }
  // Ensure asdf shims/bin are on PATH even when parent shell doesn't load them
  const asdfDir = env.ASDF_DIR ?? path.join(os.homedir(), '.asdf');
  if (fs.existsSync(asdfDir)) {
    const asdfPaths = [path.join(asdfDir, 'shims'), path.join(asdfDir, 'bin')];
    const currentPaths = env.PATH?.split(':') ?? [];
    env.PATH = [...asdfPaths, ...currentPaths.filter((p) => !asdfPaths.includes(p))].join(':');
    env.ASDF_DIR ||= asdfDir;

    const toolVersions = getToolVersionsContent(cwd);
    const hasNodeEntry = toolVersions?.split(/\r?\n/).some((line) => line.trim().startsWith('nodejs '));
    if (!hasNodeEntry) {
      env.ASDF_NODEJS_VERSION = 'lts';
      if (!installedLtsNodejs) {
        child_process.spawnSync('asdf', ['install', 'nodejs', 'lts'], {
          cwd,
          env,
          encoding: 'utf8',
          shell: false,
          stdio: 'inherit',
        });
        installedLtsNodejs = true;
      }
    }
  }

  return [
    command,
    args,
    {
      cwd,
      env,
      encoding: 'utf8',
      shell: false,
      stdio: 'inherit',
    },
  ];
}

export function getToolVersionsContent(cwd: string): string | undefined {
  if (toolVersionsCache.has(cwd)) return toolVersionsCache.get(cwd);
  const toolVersionsPath = findToolVersionsPath(cwd);
  if (!toolVersionsPath) {
    toolVersionsCache.set(cwd, undefined);
    return undefined;
  }
  const content = fs.readFileSync(toolVersionsPath, 'utf8');
  toolVersionsCache.set(cwd, content);
  return content;
}

function findToolVersionsPath(cwd: string): string | undefined {
  let current = path.resolve(cwd);
  for (;;) {
    const candidate = path.join(current, '.tool-versions');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
