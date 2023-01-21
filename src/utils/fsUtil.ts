import fsp from 'node:fs/promises';

export const fsUtil = {
  async readFileIgnoringError(filePath: string): Promise<string | undefined> {
    try {
      return await fsp.readFile(filePath, 'utf8');
    } catch {
      // do nothing
    }
  },
  async generateFile(filePath: string, content: string): Promise<void> {
    await fsp.writeFile(filePath, content);
    console.log(`Generated/Updated ${filePath}`);
  },
};
