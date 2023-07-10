import type { PackageConfig } from '../packageConfig.js';

const srcDirectories = {
  node: ['src', 'tests', 'scripts'].sort(),
  blitz: ['src', 'tests', 'scripts', 'db', 'integrations', 'mailers'].sort(),
};

export function getSrcDirs(config: PackageConfig): string[] {
  if (config.depending.blitz) {
    return srcDirectories.blitz;
  }
  return srcDirectories.node;
}
