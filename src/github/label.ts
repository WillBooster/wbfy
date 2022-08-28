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
      await setupLabel(owner, repo, 'ready', '0E8A16');
      await setupLabel(owner, repo, 'review requested', 'FBCA04');
    } catch (e) {
      console.warn('Skip setupLabels due to:', (e as Error)?.stack ?? e);
    }
  });
}

async function setupLabel(owner: string, repo: string, name: string, color: string): Promise<void> {
  try {
    await octokit.request('POST /repos/{owner}/{repo}/labels', {
      owner,
      repo,
      name,
      color,
    });
  } catch (e) {
    await octokit.request('PATCH /repos/{owner}/{repo}/labels/{name}', {
      owner,
      repo,
      name,
      color,
    });
  }
}