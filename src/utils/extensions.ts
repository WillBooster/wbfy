export const extensions = {
  codeWith2IndentSize: [
    'cjs',
    'mjs',
    'js',
    'jsx',
    'cts',
    'mts',
    'ts',
    'tsx',
    'json',
    'json5',
    'jsonc',
    'cpp',
    'dart',
    'htm',
    'html',
    'pu',
    'puml',
    'rb',
    'vue',
    'xml',
    'yaml',
    'yml',
    'sh',
  ].sort(),
  codeWith4IndentSize: ['go', 'gradle', 'py'].sort(),
  markdownLike: ['md'].sort(),
  eslint: ['cjs', 'mjs', 'js', 'cts', 'mts', 'ts', 'tsx', 'jsx'].sort(),
  prettier: [
    'cjs',
    'mjs',
    'js',
    'jsx',
    'cts',
    'mts',
    'ts',
    'tsx',
    'json',
    'json5',
    'jsonc',
    'css',
    'htm',
    'html',
    'md',
    'scss',
    'vue',
    'yaml',
    'yml',
  ].sort(),
  // cf. https://biomejs.dev/internals/language-support/
  biome: [
    'cjs',
    'mjs',
    'js',
    'jsx',
    'cts',
    'mts',
    'ts',
    'tsx',
    'json',
    'json5',
    'jsonc',
    'htm',
    'html',
    'vue',
    'svelte',
    'astro',
    'css',
    'yaml',
    'yml',
    'gql',
  ].sort(),
};
