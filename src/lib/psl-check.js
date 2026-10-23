/**
 * Public Suffix List helpers.
 *
 * isPublicSuffix(domain) returns true when the domain itself is listed
 * in the Mozilla PSL (either the ICANN or PRIVATE section), meaning
 * third-party tools like Vercel, Netlify, and GitHub Pages already know
 * to treat subdomains of it as independent registrable names.
 */
import { parse } from 'tldts';

/**
 * Returns true if `domain` is itself a known public suffix entry.
 *
 * Strategy: parse a synthetic subdomain of it. If tldts resolves
 * publicSuffix to the domain itself (rather than just the TLD), the
 * domain is registered in the PSL.
 *
 * @param {string} domain - e.g. "is-local.org" or "open-domains.net"
 * @returns {boolean}
 */
export function isPublicSuffix(domain) {
  if (!domain || typeof domain !== 'string') return false;
  try {
    const result = parse(`__psl_probe__.${domain.toLowerCase().trim()}`, {
      allowPrivateDomains: true,
    });
    return result.publicSuffix === domain.toLowerCase().trim();
  } catch {
    return false;
  }
}
