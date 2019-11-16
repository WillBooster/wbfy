import path from 'path';
import fs from 'fs-extra';
import { PackageConfig } from '../types/packageConfig';

const content = `save-prefix ""
`;

export async function generateYarnrc(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.yarnrc');
  await fs.outputFile(filePath, content);
  console.log(`Generated ${filePath}`);
}
