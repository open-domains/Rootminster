const TRANSLATION_DOM_ERROR = /Failed to execute '(?:removeChild|insertBefore)' on 'Node':/i;
const TURNSTILE_INTERNAL_ERROR = /(?:TurnstileError|Cloudflare Turnstile).*Error: 3000(?:10|30)\b/i;
const NETWORK_ERROR = /^(?:TypeError:\s*)?NetworkError when attempting to fetch resource\.?$/i;

function exceptionValues(event) {
  return event?.exception?.values || [];
}

export function shouldIgnoreClientErrorEvent(event) {
  const values = exceptionValues(event);
  const messages = [event?.message, ...values.flatMap((value) => [value?.value, `${value?.type || ''}: ${value?.value || ''}`])].filter(Boolean);

  if (messages.some((message) => TURNSTILE_INTERNAL_ERROR.test(message))) return true;
  if (messages.some((message) => TRANSLATION_DOM_ERROR.test(message))) return true;

  const stackless = !values.some((value) => value?.stacktrace?.frames?.length);
  return stackless && messages.some((message) => NETWORK_ERROR.test(message));
}
