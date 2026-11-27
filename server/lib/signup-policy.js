import { getModuleConfig } from '../core/module-settings.js';
import { OAUTH_PROVIDERS, providerConfigured } from './oauth-providers.js';

// When the social_signup_only module is on, new accounts can only be created
// through a social provider. Existing password accounts keep signing in,
// verifying their email and resetting their password as before.
export async function passwordSignupAllowed() {
  const settings = await getModuleConfig('social_signup_only');
  return !settings.enabled;
}

export async function configuredSocialProviders({ fresh = false } = {}) {
  const entries = await Promise.all(Object.entries(OAUTH_PROVIDERS).map(async ([name, provider]) => (
    providerConfigured(await getModuleConfig(provider.module, { fresh })) ? name : null
  )));
  return entries.filter(Boolean);
}
