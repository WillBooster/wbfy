import child_process from 'child_process';

const cwdToInstalled = new Map<string, boolean>();

export function spawnSync(command: string, args: string[], cwd: string): void {
  const [commandAndArgs, options] = getSpawnSyncArgs(command, args, cwd);
  console.log(`$ ${commandAndArgs} at ${options.cwd}`);
  child_process.spawnSync(commandAndArgs, options);
}

export function spawnSyncWithStringResult(command: string, args: string[], cwd: string): string {
  const [commandAndArgs, options] = getSpawnSyncArgs(command, args, cwd);
  options.stdio = 'pipe';
  const proc = child_process.spawnSync(commandAndArgs, options);
  return proc.stdout.toString().trim();
}

export function getSpawnSyncArgs(command: string, args: string[], cwd: string): [string, any] {
  const env = { ...process.env };
  // Remove berry from PATH
  if (env.PATH && env.BERRY_BIN_FOLDER) {
    env.PATH = env.PATH.replace(`${env.BERRY_BIN_FOLDER}:`, '');
  }

  let commandAndArgs = `${command} ${args.join(' ')}`;
  if (process.platform !== 'win32') {
    if (cwdToInstalled.get(cwd)) {
      cwdToInstalled.set(cwd, true);
      child_process.execSync('asdf install', { cwd, stdio: 'inherit' });
    }
    const stdio = child_process.execSync('asdf current nodejs || true', { cwd, stdio: 'pipe' }).toString();
    if (stdio && !stdio.includes(' Not ')) {
      commandAndArgs = `bash -l -c '${commandAndArgs}'`;
    }
  }
  return [commandAndArgs, { cwd, env, shell: true, stdio: 'inherit' }];
}
