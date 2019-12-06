import fse from 'fs-extra';

export const FsUtil = {
  async generateFile(filePath: string, content: string): Promise<void> {
    await fse.outputFile(filePath, content);
    console.log(`Generated ${filePath}`);
  },
};
