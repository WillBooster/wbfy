import child_process from 'child_process';

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

  const commandAndArgs = `bash -l -c '${command} ${args.join(' ')}'`;
  return [commandAndArgs, { cwd, env, shell: true, stdio: 'inherit' }];
}
