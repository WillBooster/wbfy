import { octokit } from '../utils/githubUtil.js';

export async function getLatestCommitHash(organization: string, repo: string): Promise<string> {
  try {
    const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
      owner: organization,
      repo,
      per_page: 1,
    });
    console.info('commits:', commits);
    if (commits.length === 0) {
      throw new Error(`No commits found for ${organization}/${repo}`);
    }
    return commits[0].sha;
  } catch (error) {
    throw new Error(`Failed to fetch commits for ${organization}/${repo}: ${error}`);
  }
}
