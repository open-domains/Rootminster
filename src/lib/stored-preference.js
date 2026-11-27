import { useCallback, useState } from 'react';

const browserStorage = () => {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
};

export function readStoredPreference(storage, key, allowed, fallback) {
  try {
    const value = storage?.getItem(key);
    return value != null && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredPreference(storage, key, value) {
  try { storage?.setItem(key, value); }
  catch { /* storage can be blocked or full; the preference just isn't remembered */ }
}

// Remembers a choice from a fixed set of values in this browser.
export function useStoredPreference(key, allowed, fallback) {
  const [value, setValue] = useState(() => readStoredPreference(browserStorage(), key, allowed, fallback));
  const update = useCallback((next) => {
    setValue(next);
    writeStoredPreference(browserStorage(), key, next);
  }, [key]);
  return [value, update];
}
