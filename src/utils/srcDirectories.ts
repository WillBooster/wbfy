import type { PackageConfig } from '../packageConfig.js';

const srcDirectories = {
  node: ['src', 'tests', 'scripts'].sort(),
  blitz0: ['tests', 'scripts', 'app', 'db', 'integrations', 'mailers', 'test'].sort(),
  // We rename 'test' directory to 'tests'
  blitz2: ['src', 'tests', 'scripts', 'db', 'integrations', 'mailers'].sort(),
};

export function getSrcDirs(config: PackageConfig): string[] {
  if (config.depending.blitz) {
    return config.depending.blitz === '0' ? srcDirectories.blitz0 : srcDirectories.blitz2;
  }
  return srcDirectories.node;
}
