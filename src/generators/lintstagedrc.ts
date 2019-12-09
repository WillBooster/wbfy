import path from 'path';
import fse from 'fs-extra';
import { PackageConfig } from '../types/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { Extensions } from '../utils/extensions';

const eslint = `
  "./packages/*/{src,__tests__}/**/*.{${Extensions.eslint.join(',')}}": ["eslint --fix", "git add"],`;

const prettier = `
  "./**/*.{${Extensions.prettier.join(',')}}": files => {
    const filtered = files.filter(file => !file.includes('/test-fixtures/')).join(' ');
    return filtered ? [\`prettier --write \${filtered}\`, \`git add \${filtered}\`] : [];
  },`;

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  const lines = [prettier];
  if (config.containingJavaScript || config.containingTypeScript) {
    lines.push(eslint);
  }

  const content = `module.exports = {${lines.join('')}
};
`;

  const filePath = path.resolve(config.dirPath, '.lintstagedrc.js');
  await Promise.all([
    fse.remove(path.resolve(config.dirPath, '.lintstagedrc.json')),
    FsUtil.generateFile(filePath, content),
  ]);
}
