import type { SpawnSyncOptions } from 'node:child_process';
import child_process from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function spawnSync(command: string, args: string[], cwd: string, retry = 0): void {
  do {
    const [newCmd, newArgs, options] = getSpawnSyncArgs(command, args, cwd);
    console.log(`$ ${newCmd} ${newArgs.join(' ')} at ${cwd}`);
    const ret = child_process.spawnSync(newCmd, newArgs, options);
    if (ret.status === 0) break;
  } while (--retry >= 0);
}

export function spawnSyncWithStringResult(command: string, args: string[], cwd: string): string {
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
  }

  return [
    command,
    args,
    {
      cwd,
      env,
      shell: false,
      stdio: 'inherit',
    },
  ];
}
