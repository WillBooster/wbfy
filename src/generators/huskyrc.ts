import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';
import { spawnSync } from '../utils/spawnUtil';

const DEFAULT_COMMAND = 'npm test';

const jsonObjWithoutLerna = {
  preCommit: 'yarn lint-staged',
  prePush: 'yarn typecheck',
};

const jsonObjWithLerna = {
  preCommit: 'lerna exec lint-staged --concurrency 1 --stream --since HEAD --exclude-dependents',
  prePush: 'yarn typecheck',
};

export async function generateHuskyrc(config: PackageConfig): Promise<void> {
  await fsp.rm(path.resolve(config.dirPath, '.huskyrc.json'), { force: true });

  const dirPath = path.resolve(config.dirPath, '.husky');
  if (!fs.existsSync(dirPath)) {
    if (config.containingYarnrcYml) {
      spawnSync('yarn', ['dlx', 'husky-init', '--yarn2'], config.dirPath);
    } else {
      spawnSync('npx', ['husky-init'], config.dirPath);
    }

    const preCommitFilePath = path.resolve(dirPath, 'pre-commit');
    const content = (await fsp.readFile(preCommitFilePath)).toString();

    const newJsonObj = config.containingSubPackageJsons ? jsonObjWithLerna : jsonObjWithoutLerna;
    await Promise.all([
      fsp.writeFile(preCommitFilePath, content.replace(DEFAULT_COMMAND, newJsonObj.preCommit)),
      fsp.writeFile(path.resolve(dirPath, 'pre-push'), content.replace(DEFAULT_COMMAND, newJsonObj.prePush), {
        mode: 0o755,
      }),
    ]);
  }
}
