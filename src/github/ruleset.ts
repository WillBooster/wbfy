import type { Octokit } from '@octokit/core';
import { withRetry } from '@willbooster/shared-lib';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { getOctokit, gitHubUtil, hasGitHubToken } from '../utils/githubUtil.js';

const RULESET_NAME = 'Protect main';
const GITHUB_ACTIONS_APP_ID = 15_368;
const ADMIN_TEAM_IDS = {
  WillBooster: 3_508_012,
  WillBoosterLab: 5_675_554,
};

type WillBoosterOwner = keyof typeof ADMIN_TEAM_IDS;

interface RepositoryRuleset {
  id: number;
  name: string;
  source_type?: string;
}

interface MainRulesetPayload {
  owner: WillBoosterOwner;
  repo: string;
  name: string;
  target: 'branch';
  enforcement: 'active';
  bypass_actors: {
    actor_id: number;
    actor_type: 'Team';
    bypass_mode: 'pull_request';
  }[];
  conditions: {
    ref_name: {
      include: string[];
      exclude: string[];
    };
  };
  rules: (
    | { type: 'deletion' }
    | { type: 'non_fast_forward' }
    | {
        type: 'required_status_checks';
        parameters: {
          required_status_checks: {
            context: string;
            integration_id: number;
          }[];
          strict_required_status_checks_policy: boolean;
          do_not_enforce_on_create: boolean;
        };
      }
    | {
        type: 'pull_request';
        parameters: {
          allowed_merge_methods: ['squash'];
          dismiss_stale_reviews_on_push: boolean;
          require_code_owner_review: boolean;
          require_last_push_approval: boolean;
          required_approving_review_count: number;
          required_review_thread_resolution: boolean;
          required_reviewers: [];
        };
      }
  )[];
  headers: {
    'X-GitHub-Api-Version': string;
  };
}

export async function setupRulesets(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('setupRulesets', async () => {
    const [owner, repo] = gitHubUtil.getOrgAndName(config.repository ?? '');
    if (!isWillBoosterOwner(owner) || !repo) return;
    if (!hasGitHubToken(owner)) return;

    await upsertMainRuleset(getOctokit(owner), owner, repo);
  });
}

async function upsertMainRuleset(octokit: Octokit, owner: WillBoosterOwner, repo: string): Promise<void> {
  const rulesets = await listRepositoryRulesets(octokit, owner, repo);
  const existingRuleset = rulesets.find(
    (ruleset) => ruleset.name === RULESET_NAME && ruleset.source_type === 'Repository'
  );
  const payload = createMainRulesetPayload(owner, repo);

  if (existingRuleset) {
    // Administration permission
    await withRetry(() =>
      octokit.request('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
        ...payload,
        ruleset_id: existingRuleset.id,
      })
    );
    return;
  }

  // Administration permission
  await withRetry(() => octokit.request('POST /repos/{owner}/{repo}/rulesets', { ...payload }));
}

async function listRepositoryRulesets(
  octokit: Octokit,
  owner: WillBoosterOwner,
  repo: string
): Promise<RepositoryRuleset[]> {
  // Administration permission
  const response = await withRetry(() =>
    octokit.request('GET /repos/{owner}/{repo}/rulesets', {
      owner,
      repo,
      includes_parents: false,
      targets: 'branch',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  );
  return response.data as RepositoryRuleset[];
}

function createMainRulesetPayload(owner: WillBoosterOwner, repo: string): MainRulesetPayload {
  return {
    owner,
    repo,
    name: RULESET_NAME,
    target: 'branch' as const,
    enforcement: 'active' as const,
    bypass_actors: [
      {
        actor_id: ADMIN_TEAM_IDS[owner],
        actor_type: 'Team' as const,
        bypass_mode: 'pull_request' as const,
      },
    ],
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: [],
      },
    },
    rules: [
      {
        type: 'deletion' as const,
      },
      {
        type: 'required_status_checks' as const,
        parameters: {
          required_status_checks: [
            {
              context: 'semantic-pr / semantic-pr',
              integration_id: GITHUB_ACTIONS_APP_ID,
            },
            {
              context: 'test / test',
              integration_id: GITHUB_ACTIONS_APP_ID,
            },
          ],
          strict_required_status_checks_policy: false,
          do_not_enforce_on_create: true,
        },
      },
      {
        type: 'non_fast_forward' as const,
      },
      {
        type: 'pull_request' as const,
        parameters: {
          allowed_merge_methods: ['squash' as const],
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_approving_review_count: 0,
          required_review_thread_resolution: false,
          required_reviewers: [],
        },
      },
    ],
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
}

function isWillBoosterOwner(owner: string): owner is WillBoosterOwner {
  return owner === 'WillBooster' || owner === 'WillBoosterLab';
}
