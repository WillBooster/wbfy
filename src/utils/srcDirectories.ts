import { PackageConfig } from '../packageConfig';

const srcDirectories = {
  node: ['src', '__tests__', 'scripts'].sort(),
  // pages は Blitz2 でのみ使用されている。
  blitz: ['__tests__', 'scripts', 'app', 'db', 'integrations', 'mailers', 'pages', 'test'].sort(),
};

export function getSrcDirs(config: PackageConfig): string[] {
  return config.depending.blitz ? srcDirectories.blitz : srcDirectories.node;
}
