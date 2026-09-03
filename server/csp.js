export const CSP_SCRIPT_HASHES = Object.freeze([
  // Static Google Analytics bootstrap in index.html.
  "'sha256-wQNcntwe3G83H1+3Fbqkxq7Z0TlIdoWRj9I3fRGFQO4='",
  // Cloudflare edge bootstrap currently injected after the document body.
  "'sha256-ogQbUhKdp41/4HBFZpIa6bSUJqoP3Mp3/HQfUwKITPY='",
]);

export const contentSecurityPolicy = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    ...CSP_SCRIPT_HASHES,
    'https://analytics.open-domains.com',
    'https://www.googletagmanager.com',
    'https://challenges.cloudflare.com',
  ],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https://media.rootminster.com',
    'https://flagcdn.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
  ],
  connectSrc: [
    "'self'",
    'https://analytics.open-domains.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://challenges.cloudflare.com',
  ],
  frameSrc: ['https://challenges.cloudflare.com'],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  objectSrc: ["'none'"],
});
