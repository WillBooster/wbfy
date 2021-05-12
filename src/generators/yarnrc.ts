import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import yaml from 'js-yaml';

import { FsUtil } from '../utils/fsUtil';
import { PackageConfig } from '../utils/packageConfig';
import { spawnSync } from '../utils/spawnUtil';

const content = `save-prefix ""
`;

export async function generateYarnrc(config: PackageConfig): Promise<void> {
  const yarnrcPath = path.resolve(config.dirPath, '.yarnrc');
  if (config.containingYarnrcYml) {
    if (fs.existsSync(yarnrcPath)) {
      fsp.rm(yarnrcPath, { force: true }).then();
    }

    const yarnrcYmlPath = path.resolve(config.dirPath, '.yarnrc.yml');
    const doc = yaml.load(await fsp.readFile(yarnrcYmlPath, 'utf8')) as any;
    doc.defaultSemverRangePrefix = '';
    config.requiringNodeModules = doc.nodeLinker !== 'node-modules';
    await fsp.writeFile(yarnrcYmlPath, yaml.dump(doc));
    if (
      (config.containingTypeScript || config.containingTypeScriptInPackages) &&
      !(doc.plugins || []).some((p: any) => p.spec === '@yarnpkg/plugin-typescript')
    ) {
      spawnSync('yarn', ['plugin', 'import', 'typescript'], config.dirPath);
    }
    if (config.containingSubPackageJsons) {
      spawnSync('yarn', ['plugin', 'remove', '@yarnpkg/plugin-workspace-tools'], config.dirPath);
    }
  } else {
    await FsUtil.generateFile(yarnrcPath, content);
  }
}
