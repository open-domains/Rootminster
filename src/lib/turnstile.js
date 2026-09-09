const SCRIPT_ID = 'rootminster-turnstile';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading;

export function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Turnstile requires a browser'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement('script');
    let timeout;

    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const loaded = () => {
      cleanup();
      if (window.turnstile) resolve(window.turnstile);
      else failed();
    };
    const failed = () => {
      cleanup();
      script.remove();
      loading = undefined;
      reject(new Error('Cloudflare Turnstile could not load'));
    };

    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    timeout = window.setTimeout(failed, 15_000);

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return loading;
}
