import path from 'path';
import fs from 'fs-extra';
import merge from 'deepmerge';
import { PackageConfig } from '../types/packageConfig';

const eslintKey = './{packages/*/,}{src,__tests__}/**/*.{ts,tsx}';

function generateJsonObj(): { [prop: string]: string[] } {
  return {
    [eslintKey]: ['eslint --fix', 'git add'],
    './**/*.{css,htm,html,js,json,jsx,md,scss,yaml,yml}': ['prettier --write', 'git add'],
    './**/package.json': ['sort-package-json', 'git add'],
  };
}

const firstItemShouldBeDeleted = Object.values(generateJsonObj()).map((array: string[]) => array[0]);

export async function generateLintstagedrc(config: PackageConfig): Promise<void> {
  let jsonObj = generateJsonObj();

  const filePath = path.resolve(config.dirPath, '.lintstagedrc.json');
  if (fs.existsSync(filePath)) {
    const existingContent = fs.readFileSync(filePath).toString();
    try {
      const existingJsonObj = JSON.parse(existingContent);
      for (const key in existingJsonObj) {
        if (firstItemShouldBeDeleted.includes(existingJsonObj[key][0])) {
          delete existingJsonObj[key];
        }
      }
      jsonObj = merge(existingJsonObj, jsonObj);
    } catch (e) {
      // do nothing
    }
  }
  if (!config.containingJavaScript && !config.containingTypeScript) {
    delete jsonObj[eslintKey];
  }
  await fs.outputFile(filePath, JSON.stringify(jsonObj));
  console.log(`Generated ${filePath}`);
}
