import { matchProtectedBrand, parseBrandList, protectedBrandMessage } from '../../shared/brand-protection.js';

// Stored in PlatformSettings so the risk rules (safety-screening.js) read the same list.
export const PROTECTED_BRANDS_KEY = 'safety_protected_brands';

export async function loadProtectedBrands(entities) {
  const rows = await entities.PlatformSettings.filter({ key: PROTECTED_BRANDS_KEY });
  return parseBrandList(rows[0]?.value || '');
}

// Returns a refusal message when a non-staff user asks for a name that imitates a
// protected brand, otherwise null. Staff and admins can still register these names.
export async function protectedBrandRefusal(entities, subdomain, user) {
  if (['staff', 'admin'].includes(user?.role)) return null;
  const brand = matchProtectedBrand(subdomain, await loadProtectedBrands(entities));
  return brand ? protectedBrandMessage(subdomain, brand) : null;
}
