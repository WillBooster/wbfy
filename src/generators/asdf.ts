import fsp from 'fs/promises';
import path from 'path';

import { PackageConfig } from '../utils/packageConfig';

export async function generateVersionConfigs(config: PackageConfig): Promise<void> {
  try {
    const versionsText = await fsp.readFile(path.resolve(config.dirPath, '.tool-versions'), 'utf-8');
    const lines = [];
    for (const versionText of versionsText.split('\n')) {
      const line = versionText.trim();
      if (!line.startsWith('nodejs')) {
        lines.push(line);
        continue;
      }

      const [, version] = line.split(/\s+/);
      await fsp.writeFile(path.resolve(config.dirPath, '.node-version'), version);
    }
  } catch (_) {
    // do nothing
  }
}
