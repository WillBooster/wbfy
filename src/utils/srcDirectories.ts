import { PackageConfig } from '../packageConfig';

const srcDirectories = {
  node: ['src', '__tests__', 'scripts'],
  blitz: ['app', 'db', 'integrations', 'mailers', 'test'],
};

srcDirectories.blitz = [...srcDirectories.node, ...srcDirectories.blitz];

export function getSrcDirs(config: PackageConfig): string[] {
  return config.depending.blitz ? srcDirectories.blitz : srcDirectories.node;
}
