import fsp from 'fs/promises';

export const FsUtil = {
  async generateFile(filePath: string, content: string): Promise<void> {
    await fsp.writeFile(filePath, content);
    console.log(`Generated ${filePath}`);
  },
};
