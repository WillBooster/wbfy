import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string): void {
  let commandAndArgs = `${command} ${args.join(' ')}`;
  if (command === 'yarn' && process.platform !== 'win32') {
    const version = child_process
      .execSync('nodenv local', { cwd })
      .toString()
      .trim();
    if (!version.includes(' no ')) {
      commandAndArgs = `zsh -l -c 'eval "$(nodenv init -)" && nodenv shell "${version}" && ${commandAndArgs}'`;
    }
  }
  console.log(`$ ${commandAndArgs} at ${cwd}`);
  child_process.spawnSync(commandAndArgs, { cwd, shell: true, stdio: 'inherit' });
}
