import fs from 'fs-extra';

export const FsUtil = {
  async generateFile(filePath: string, content: string): Promise<void> {
    await fs.outputFile(filePath, content);
    console.log(`Generated ${filePath}`);
  },
};
