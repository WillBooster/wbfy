import { options } from './options.js';

class Logger {
  async function(name: string, func: () => Promise<void>): Promise<void> {
    if (options.isVerbose) {
      console.info(`--------- ${name} start ---------`);
    }
    await func();
    if (options.isVerbose) {
      console.info(`---------- ${name} end ----------`);
    }
  }
}

export const logger = new Logger();
