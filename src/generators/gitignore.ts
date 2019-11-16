import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../types/packageConfig';

const names = ['node', 'jetbrains', 'visualstudiocode', 'vim', 'windows', 'macos'];

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
dist/
temp/
`;

export async function generateGitignore(config: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.gitignore');
  const userContent = IgnoreFileUtil.getUserContent(filePath) || defaultUserContent;
  let content = '';
  for (const name of names) {
    const response = await fetch(`https://www.gitignore.io/api/${name}`);
    content += await response.text();
  }
  await fs.outputFile(filePath, userContent + commonContent + content);
  console.log(`Generated ${filePath}`);
}
