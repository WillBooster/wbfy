import { Octokit } from '@octokit/core';

const token =
  process.env.GH_BOT_PAT || process.env.PUBLIC_GH_BOT_PAT || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
export const hasGitHubToken = !!token;
export const octokit = new Octokit({
  auth: token,
});

class GitHubUtil {
  getOrgAndName(urlOrFullName: string): [string, string] {
    const urlWithoutProtocol = urlOrFullName.split(':').at(-1);
    const names = urlWithoutProtocol?.split('/');
    const org = names?.at(-2) ?? '';
    const name = names?.at(-1)?.replace(/.git$/, '') ?? '';
    return [org, name];
  }
}

export const gitHubUtil = new GitHubUtil();
