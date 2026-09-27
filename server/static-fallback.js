const API_ROUTE = /^\/(?:api|functions)(?:[/?]|$)/;
const BUILT_ASSET_ROUTE = /^\/assets(?:\/|$)/;

export function shouldServeSpaFallback(url = '') {
  const pathname = new URL(url, 'https://rootminster.local').pathname;
  if (API_ROUTE.test(pathname)) return false;
  if (BUILT_ASSET_ROUTE.test(pathname)) return false;
  return true;
}
