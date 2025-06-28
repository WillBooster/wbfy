import type { PackageConfig } from '../packageConfig.js';

const srcDirectories = {
  node: ['src', 'test', 'scripts'].sort(),
  blitz: ['src', 'test', 'scripts', 'db', 'integrations', 'mailers'].sort(),
};

export function getSrcDirs(config: PackageConfig): string[] {
  if (config.depending.blitz) {
    return srcDirectories.blitz;
  }
  return srcDirectories.node;
}
