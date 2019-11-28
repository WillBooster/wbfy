import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string): void {
  const commandWithNodenv = `zsh -l -c 'eval "$(nodenv init -)" && nodenv shell "$(nodenv local)" && ${command} ${args.join(
    ' '
  )}'`;
  console.log(`$ ${commandWithNodenv} at ${cwd}`);
  child_process.spawnSync(commandWithNodenv, { cwd, shell: true, stdio: 'inherit' });
}
