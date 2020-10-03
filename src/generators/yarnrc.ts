import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import { PackageConfig } from '../utils/packageConfig';
import { FsUtil } from '../utils/fsUtil';
import { spawnSync } from '../utils/spawnUtil';

const content = `save-prefix ""
`;

export async function generateYarnrc(config: PackageConfig): Promise<void> {
  const yarnrcPath = path.resolve(config.dirPath, '.yarnrc');
  if (config.containingYarnrcYml) {
    if (fse.existsSync(yarnrcPath)) {
      fse.unlinkSync(yarnrcPath);
    }

    const yarnrcYmlPath = path.resolve(config.dirPath, '.yarnrc.yml');
    const doc = yaml.safeLoad(fse.readFileSync(yarnrcYmlPath, 'utf8')) as any;
    doc.defaultSemverRangePrefix = '';
    doc.nodeLinker = doc.nodeLinker || 'node-modules';
    fse.writeFileSync(yarnrcYmlPath, yaml.safeDump(doc));
    if (
      (config.containingTypeScript || config.containingTypeScriptInPackages) &&
      !(doc.plugins || []).some((p: any) => p.spec === '@yarnpkg/plugin-typescript')
    ) {
      spawnSync('yarn', ['plugin', 'import', 'typescript'], config.dirPath);
    }
  } else {
    await FsUtil.generateFile(yarnrcPath, content);
  }
}
