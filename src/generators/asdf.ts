import fsp from 'fs/promises';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  try {
    const toolVersionsPath = path.resolve(config.dirPath, '.tool-versions');
    const versionsText = await fsp.readFile(toolVersionsPath, 'utf-8');
    const lines = [];
    const promises = [];
    for (const versionText of versionsText.split('\n')) {
      const line = versionText.trim();
      if (!line.startsWith('nodejs')) {
        lines.push(line);
        continue;
      }

      const [, version] = line.split(/\s+/);
      promises.push(fsp.writeFile(path.resolve(config.dirPath, '.node-version'), version));
    }
    if (lines.length) {
      promises.push(fsp.writeFile(toolVersionsPath, lines.join('\n')));
    } else {
      promises.push(fsp.rm(toolVersionsPath, { force: true }));
    }
    await Promise.all(promises);
  } catch (_) {
    // do nothing
  }
}
