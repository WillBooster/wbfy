/* eslint-disable import-x/no-named-as-default-member */

import dotenv from 'dotenv';
import sodium from 'libsodium-wrappers';

import { logger } from '../logger.js';
import { options } from '../options.js';
import type { PackageConfig } from '../packageConfig.js';
import { gitHubUtil, hasGitHubToken, octokit } from '../utils/githubUtil.js';

const deprecatedSecretNames = ['READY_DISCORD_WEBHOOK_URL'];

export async function setupSecrets(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('setupSecrets', async () => {
    if (!hasGitHubToken || !options.doesUploadEnvVars) return;

    const [owner, repo] = gitHubUtil.getOrgAndName(config.repository ?? '');
    if (!owner || !repo || owner !== 'WillBoosterLab') return;

    const parsed = dotenv.config().parsed || {};
    if (Object.keys(parsed).length === 0) return;

    try {
      for (const secretName of deprecatedSecretNames) {
        try {
          await octokit.request('DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
            owner,
            repo,
            secret_name: secretName,
          });
        } catch {
          // do nothing
        }
      }

      const response = await octokit.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
        owner,
        repo,
      });
      const { key, key_id: keyId } = response.data;

      await sodium.ready;

      for (const [name, secret] of Object.entries(parsed)) {
        if (config.isPublicRepo && name === 'GH_BOT_PAT') continue;
        if (!config.isPublicRepo && name === 'PUBLIC_GH_BOT_PAT') continue;

        // Convert Secret & Base64 key to Uint8Array.
        const rawKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
        const rawSec = sodium.from_string(secret);

        // Encrypt the secret using LibSodium
        const encBytes = sodium.crypto_box_seal(rawSec, rawKey);

        // Convert encrypted Uint8Array to Base64
        const encBase64 = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

        await octokit.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
          owner,
          repo,
          secret_name: name,
          encrypted_value: encBase64,
          key_id: keyId,
        });
      }
    } catch (error) {
      console.warn('Skip setupSecrets due to:', (error as Error)?.stack ?? error);
    }
  });
}
