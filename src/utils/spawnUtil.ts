import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string, retry = 0): void {
  do {
    const [commandAndArgs, options] = getSpawnSyncArgs(command, args, cwd);
    console.log(`$ ${commandAndArgs} at ${options.cwd}`);
    const ret = child_process.spawnSync(commandAndArgs, options);
    if (ret.status === 0) break;
  } while (--retry >= 0);
}

export function spawnSyncWithStringResult(command: string, args: string[], cwd: string): string {
  const [commandAndArgs, options] = getSpawnSyncArgs(command, args, cwd);
  options.stdio = 'pipe';
  const proc = child_process.spawnSync(commandAndArgs, options);
  return proc.stdout.toString().trim();
}

export function getSpawnSyncArgs(command: string, args: string[], cwd: string): [string, any] {
  let commandAndArgs = `${command} ${args.join(' ')}`;
  if (process.env.ASDF_DIR) {
    commandAndArgs = `bash -l -c '. ${process.env.ASDF_DIR}/asdf.sh && ${commandAndArgs}'`;
  }
  return [
    commandAndArgs,
    {
      cwd,
      env: {
        PATH: process.env.PATH,
      },
      shell: true,
      stdio: 'inherit',
    },
  ];
}
