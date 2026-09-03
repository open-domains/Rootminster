import { getPublicConfig } from '@/lib/public-config';

let sdk;
let startup;

function withoutQuery(value) {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function scrubClientEvent(event) {
  const clean = { ...event };
  delete clean.user;
  delete clean.breadcrumbs;
  delete clean.extra;
  if (clean.request) {
    clean.request = { ...clean.request, url: withoutQuery(clean.request.url) };
    delete clean.request.cookies;
    delete clean.request.data;
    delete clean.request.headers;
  }
  if (clean.transaction) clean.transaction = clean.transaction.split(/[?#]/)[0];
  if (clean.spans) clean.spans = clean.spans.map((span) => ({ ...span, data: undefined, description: span.description?.split(/[?#]/)[0] }));
  return clean;
}

export function initializeClientGlitchTip() {
  if (startup) return startup;
  startup = getPublicConfig()
    .then(async ({ glitchtip }) => {
      if (!glitchtip?.enabled || !glitchtip.dsn) return null;
      sdk = await import('@sentry/react');
      const tracesSampleRate = Number(glitchtip.traceSampleRate) || 0;
      sdk.init({
        dsn: glitchtip.dsn,
        tunnel: glitchtip.tunnel,
        environment: glitchtip.environment,
        sampleRate: glitchtip.errorSampleRate,
        tracesSampleRate,
        integrations: (defaults) => tracesSampleRate > 0
          ? [...defaults, sdk.browserTracingIntegration()]
          : defaults,
        sendDefaultPii: false,
        beforeSend: scrubClientEvent,
        beforeSendTransaction: scrubClientEvent,
      });
      return sdk;
    })
    .catch((error) => {
      console.warn('GlitchTip monitoring could not start', error);
      return null;
    });
  return startup;
}

export function captureClientException(error, context = {}) {
  initializeClientGlitchTip().then((client) => {
    if (!client) return;
    client.withScope((scope) => {
      scope.setContext('react', context);
      client.captureException(error);
    });
  });
}
