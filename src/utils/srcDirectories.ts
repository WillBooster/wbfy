import { PackageConfig } from '../packageConfig.js';

const srcDirectories = {
  node: ['src', '__tests__', 'scripts'].sort(),
  blitz0: ['__tests__', 'scripts', 'app', 'db', 'integrations', 'mailers', 'test'].sort(),
  // We rename 'test' directory to '__tests__'
  blitz2: ['src', '__tests__', 'scripts', 'db', 'integrations', 'mailers'].sort(),
};

export function getSrcDirs(config: PackageConfig): string[] {
  if (config.depending.blitz) {
    return config.depending.blitz === '0' ? srcDirectories.blitz0 : srcDirectories.blitz2;
  }
  return srcDirectories.node;
}
