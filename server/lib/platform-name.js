import { getModuleConfig } from '../core/module-settings.js';

export const DEFAULT_PLATFORM_NAME = 'Open Domains';

// The site name set in the Branding module, for text the server sends outside
// the web app (Discord messages, notifications).
export async function platformName() {
  const branding = await getModuleConfig('branding').catch(() => null);
  return String((branding?.enabled && branding.platform_name) || DEFAULT_PLATFORM_NAME).trim().slice(0, 80) || DEFAULT_PLATFORM_NAME;
}
