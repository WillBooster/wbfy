import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string, retry = 0): void {
  do {
    const [newCmd, newArgs, options] = getSpawnSyncArgs(command, args, cwd);
    console.log(`$ ${newCmd} ${newArgs.join(' ')} at ${options.cwd}`);
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
    console.error(`${newCmd} [${newArgs.map((s) => `"${s}"`)}] caused the following error:\n ${error}`);
  }
  return proc.stdout.toString().trim();
}

export function getSpawnSyncArgs(command: string, args: string[], cwd: string): [string, string[], any] {
  const env = { ...process.env };
  // Remove berry from PATH
  if (env.PATH && env.BERRY_BIN_FOLDER) {
    env.PATH = env.PATH.replace(`${env.BERRY_BIN_FOLDER}:`, '');
  }

  if (env.ASDF_DIR) {
    args = ['-l', '-c', `. ${env.ASDF_DIR}/asdf.sh && ${command} ${args.join(' ')}`];
    command = 'bash';
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
