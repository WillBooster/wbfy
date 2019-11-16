import fs from 'fs-extra';

export const IgnoreFileUtil = {
  header: '# Project-specific settings',
  separator: '# Generated by @willbooster/willboosterify',
  separatorPrefix: '# Generated by @willbooster',
  getExistingContent(filePath: string): string | null {
    if (fs.existsSync(filePath)) {
      return fs
        .readFileSync(filePath)
        .toString()
        .replace(/# Project-specific settings[^\n]*\n/m, '')
        .replace(/# Generated by[^\n]*\n/m, '')
        .replace(/\r?\n\r?\n(\r?\n)+/gm, '\n\n');
    }
    return null;
  },
  getUserContent(filePath: string): string | null {
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath).toString();
      const index = existingContent.indexOf(this.separatorPrefix);
      if (index >= 0) {
        return existingContent.substr(0, existingContent.indexOf('\n', index) + 1);
      }
    }
    return null;
  },
};
