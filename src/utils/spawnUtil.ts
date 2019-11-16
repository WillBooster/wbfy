import child_process from 'child_process';

export function spawnSync(command: string, args: string[], cwd: string): void {
  console.log(`$ ${command} ${args.join(' ')} at ${cwd}`);
  child_process.spawnSync(command, args, { cwd, shell: true, stdio: 'inherit' });
}
