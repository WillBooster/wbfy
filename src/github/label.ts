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
      await setupLabel(owner, repo, 'd1: x-easy :hedgehog:', 'EDE9FE');
      await setupLabel(owner, repo, 'd2: easy :rabbit2:', 'DDD6FE');
      await setupLabel(owner, repo, 'd3: medium :ox:', 'C4B5FD');
      await setupLabel(owner, repo, 'd4: hard :squid:', 'A78BFA');
      await setupLabel(owner, repo, 'd5: x-hard :whale2:', '8B5CF6');
      await setupLabel(owner, repo, 'p1: critical :fire::fire::fire:', 'EF4444');
      await setupLabel(owner, repo, 'p2: urgent :fire::fire:', 'F87171');
      await setupLabel(owner, repo, 'p3: important :fire:', 'FCA5A5');
      await setupLabel(owner, repo, 'p4: nice to have :droplet:', 'FECACA');
      await setupLabel(owner, repo, 'r: blitz', '5300bc');
      await setupLabel(owner, repo, 'r: prisma', '0c344b');
      await setupLabel(owner, repo, 'r: react', '61dafb');
      await setupLabel(owner, repo, 'r: svelte', 'ff3e00');
      await setupLabel(owner, repo, 'ready :rocket:', '22C55E');
      await setupLabel(owner, repo, 'review requested :mag:', 'FBCA04');
      await setupLabel(owner, repo, 's: 0.5h :clock1230:', 'F3F4F6');
      await setupLabel(owner, repo, 's: 1h :clock1:', 'E5E7EB');
      await setupLabel(owner, repo, 's: 2h :clock2:', 'D1D5DB');
      await setupLabel(owner, repo, 's: 3h :clock3:', '9CA3AF');
      await setupLabel(owner, repo, 's: 5h :clock5:', '6B7280');
      await setupLabel(owner, repo, 's: 8h :clock8:', '4B5563');
      await setupLabel(owner, repo, 's: 13h :clock1:', '374151');
      await setupLabel(owner, repo, 't: build :hammer:', 'BFDBFE');
      await setupLabel(owner, repo, 't: chore :broom:', 'BFDBFE');
      await setupLabel(owner, repo, 't: ci :construction_worker:', 'BFDBFE');
      await setupLabel(owner, repo, 't: docs :memo:', 'BFDBFE');
      await setupLabel(owner, repo, 't: feat :sparkles:', 'BFDBFE');
      await setupLabel(owner, repo, 't: fix :bug:', 'BFDBFE');
      await setupLabel(owner, repo, 't: perf :zap:', 'BFDBFE');
      await setupLabel(owner, repo, 't: refactor :recycle:', 'BFDBFE');
      await setupLabel(owner, repo, 't: style :lipstick:', 'BFDBFE');
      await setupLabel(owner, repo, 't: test :test_tube:', 'BFDBFE');

      await deleteLabel(owner, repo, 'bug');
      await deleteLabel(owner, repo, 'documentation');
      await deleteLabel(owner, repo, 'duplicate');
      await deleteLabel(owner, repo, 'enhancement');
      await deleteLabel(owner, repo, 'good first issue');
      await deleteLabel(owner, repo, 'help wanted');
      await deleteLabel(owner, repo, 'invalid');
      await deleteLabel(owner, repo, 'question');
      await deleteLabel(owner, repo, 'wontfix');
      
      await deleteLabel(owner, repo, 'ready');
      await deleteLabel(owner, repo, 'review requested');
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

async function deleteLabel(owner: string, repo: string, name: string): Promise<void> {
  try {
    await octokit.request('DELETE /repos/{owner}/{repo}/labels/{name}', {
      owner,
      repo,
      name,
    });
  } catch (e) {
    // do nothing
  }
}
