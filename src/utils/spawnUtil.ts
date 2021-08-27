import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string): void {
  const [commandAndArgs, options] = getSpawnSyncArgs(command, args, cwd);
  console.log(`$ ${commandAndArgs} at ${options.cwd}`);
  child_process.spawnSync(commandAndArgs, options);
}

export function getSpawnSyncArgs(command: string, args: string[], cwd: string): [string, any] {
  const env = { ...process.env };
  // Remove berry from PATH
  if (env.PATH && env.BERRY_BIN_FOLDER) {
    env.PATH = env.PATH.replace(`${env.BERRY_BIN_FOLDER}:`, '');
  }

  let commandAndArgs = `${command} ${args.join(' ')}`;
  if (process.platform !== 'win32') {
    const [, version] = child_process
      .execSync('asdf current nodejs || true', { cwd, stdio: 'pipe' })
      .toString()
      .split(' ')
      .filter((s) => !!s);
    if (version && !version.includes(' no ')) {
      commandAndArgs = `zsh -l -c '. /usr/local/opt/asdf/asdf.sh && ${commandAndArgs}'`;
    }
  }
  return [commandAndArgs, { cwd, env, shell: true, stdio: 'inherit' }];
}
