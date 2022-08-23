import { logger } from '../logger';
import { PackageConfig } from '../packageConfig';
import { gitHubUtil, hasGitHubToken, octokit } from '../utils/githubUtil';

export async function setupLabels(config: PackageConfig): Promise<void> {
  return logger.function('setupLabels', async () => {
    if (!hasGitHubToken) return;

    const [owner, repo] = gitHubUtil.getOrgAndName(config.repository ?? '');
    if (!owner || !repo) return;
    if (!config.publicRepo && owner === 'WillBooster') return;

    try {
      try {
        await octokit.request('POST /repos/{owner}/{repo}/labels', {
          owner: owner,
          repo: repo,
          name: 'ready',
          color: '1B8D81',
        });
      } catch (e) {
        await octokit.request('PATCH /repos/{owner}/{repo}/labels/{name}', {
          owner: owner,
          repo: repo,
          name: 'ready',
          color: '1B8D81',
        });
      }

      try {
        await octokit.request('POST /repos/{owner}/{repo}/labels', {
          owner: owner,
          repo: repo,
          name: 'review requested',
          color: 'FBCA04',
        });
      } catch (e) {
        await octokit.request('PATCH /repos/{owner}/{repo}/labels/{name}', {
          owner: owner,
          repo: repo,
          name: 'review requested',
          color: 'FBCA04',
        });
      }
    } catch (e) {
      console.warn('Skip setupLabels due to:', (e as Error)?.stack ?? e);
    }
  });
}
