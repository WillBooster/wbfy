import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string): void {
  const commandPrefix =
    process.platform === 'win32' ? '' : `zsh -l -c 'eval "$(nodenv init -)" && nodenv shell "$(nodenv local)" && `;
  const commandAndArgs = `${commandPrefix}${command} ${args.join(' ')}'`;
  console.log(`$ ${commandAndArgs} at ${cwd}`);
  child_process.spawnSync(commandAndArgs, { cwd, shell: true, stdio: 'inherit' });
}
