import type { SpawnSyncOptions } from 'node:child_process';
import child_process from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Avoid repeating the same install when multiple commands run in a row.
const installedLtsNodejs = false;
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- spawnSync returns null stderr on ENOENT.
  const stderr = proc.stderr ?? '';
  const error = typeof stderr === 'string' ? stderr.trim() : stderr.toString().trim();
  if (proc.error) {
    console.error(`${newCmd} [${newArgs.map((s) => `"${s}"`).join(', ')}] failed with: ${proc.error.message}`);
  } else if (error) {
    console.error(
      `${newCmd} [${newArgs.map((s) => `"${s}"`).join(', ')}] outputs the following content to stderr:\n${error}`
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- spawnSync returns null stdout on ENOENT.
  const stdout = proc.stdout ?? '';
  return typeof stdout === 'string' ? stdout.trim() : stdout.toString().trim();
}

export function getSpawnSyncArgs(command: string, args: string[], cwd: string): [string, string[], SpawnSyncOptions] {
  const env = { ...process.env };
  // Remove berry from PATH
  if (env.PATH && env.BERRY_BIN_FOLDER) {
    env.PATH = env.PATH.replace(`${env.BERRY_BIN_FOLDER}:`, '');
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
  const toolConfig = findToolConfigPath(cwd);
  if (!toolConfig) {
    toolVersionsCache.set(cwd, undefined);
    return undefined;
  }
  const content = fs.readFileSync(toolConfig.path, 'utf8');
  const resolvedContent = toolConfig.kind === 'mise' ? parseMiseTools(content) : content;
  toolVersionsCache.set(cwd, resolvedContent);
  return resolvedContent;
}

function findToolConfigPath(cwd: string): { path: string; kind: 'mise' | 'tool-versions' } | undefined {
  let current = path.resolve(cwd);
  for (;;) {
    const misePath = path.join(current, 'mise.toml');
    if (fs.existsSync(misePath)) return { path: misePath, kind: 'mise' };
    const miseHiddenPath = path.join(current, '.mise.toml');
    if (fs.existsSync(miseHiddenPath)) return { path: miseHiddenPath, kind: 'mise' };
    const toolVersionsPath = path.join(current, '.tool-versions');
    if (fs.existsSync(toolVersionsPath)) return { path: toolVersionsPath, kind: 'tool-versions' };
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function parseMiseTools(content: string): string | undefined {
  const lines = content.split(/\r?\n/);
  let inTools = false;
  const entries: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[')) {
      inTools = trimmed === '[tools]';
      continue;
    }
    if (!inTools) continue;
    const match = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(trimmed);
    if (!match) continue;
    const tool = match[1];
    let value = (match[2] ?? '').trim();
    if (!value) continue;
    if (value.startsWith('[')) {
      const arrayMatch = /["']([^"']+)["']/.exec(value);
      if (!arrayMatch?.[1]) continue;
      value = arrayMatch[1];
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    entries.push(`${tool} ${value}`);
  }
  return entries.length > 0 ? entries.join('\n') : undefined;
}
