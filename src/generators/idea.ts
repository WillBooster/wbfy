import path from 'path';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import fse from 'fs-extra';

const content = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectTasksOptions">
    <enabled-global>
      <option value="Prettier (TypeScript JSX)" />
      <option value="Prettier (TypeScript)" />
      <option value="Prettier (JavaScript)" />
      <option value="Prettier (JSON)" />
      <option value="Prettier (Markdown)" />
    </enabled-global>
  </component>
</project>
`;

export async function generateIdeaSettings(config: PackageConfig): Promise<void> {
  const dirPath = path.resolve(config.dirPath, '.idea');
  if (fse.existsSync(dirPath)) {
    const filePath = path.resolve(dirPath, 'watcherTasks.xml');
    await FsUtil.generateFile(filePath, content);
  }
}
