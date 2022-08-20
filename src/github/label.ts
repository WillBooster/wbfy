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
      // TODO: create `ready` and `review requested` labels
      // c.f. https://docs.github.com/ja/rest/issues/labels#create-a-label
      // const response = await octokit.request('XXXXXXXX', {
      //   owner,
      //   repo,
      // });
    } catch (e) {
      console.warn('Skip setupLabels due to:', (e as Error)?.stack ?? e);
    }
  });
}
