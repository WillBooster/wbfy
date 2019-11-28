import path from 'path';
import fetch from 'node-fetch';
import { IgnoreFileUtil } from '../utils/ignoreFileUtil';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';

const defaultNames = ['node', 'jetbrains', 'visualstudiocode', 'vim', 'windows', 'macos'];

const defaultUserContent = `${IgnoreFileUtil.header}


${IgnoreFileUtil.separator}
`;

const commonContent = `
.devcontainer/
dist/
temp/
`;

export async function generateGitignore(config: PackageConfig, rootConfig: PackageConfig): Promise<void> {
  const filePath = path.resolve(config.dirPath, '.gitignore');
  const userContent = IgnoreFileUtil.getUserContent(filePath) || defaultUserContent;
  let content = '';
  const names = [...defaultNames];
  if (rootConfig.depending.firebase || config.depending.firebase) {
    names.push('firebase');
  }
  for (const name of names) {
    const response = await fetch(`https://www.gitignore.io/api/${name}`);
    content += (await response.text()).replace('public/', '');
  }
  await FsUtil.generateFile(filePath, userContent + commonContent + content);
}
