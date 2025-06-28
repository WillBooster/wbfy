import fs from 'node:fs';
import path from 'node:path';

export const fsUtil = {
  async readFileIgnoringError(filePath: string): Promise<string | undefined> {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch {
      // do nothing
    }
  },
  async generateFile(filePath: string, content: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content);
    console.log(`Generated/Updated ${filePath}`);
  },
};
