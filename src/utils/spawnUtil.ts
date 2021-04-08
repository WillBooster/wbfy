import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string): void {
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
  console.log(`$ ${commandAndArgs} at ${cwd}`);
  child_process.spawnSync(commandAndArgs, { cwd, shell: true, stdio: 'inherit' });
}
