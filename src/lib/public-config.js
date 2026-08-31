import { useEffect, useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';

const EMPTY_CONFIG = Object.freeze({
  features: { donations: false, nsRequiresDonation: true },
  oauth: { google: false, github: false },
});

let cachedConfig = null;
let pendingConfig = null;

export async function getPublicConfig() {
  if (cachedConfig) return cachedConfig;
  if (!pendingConfig) {
    pendingConfig = rootminster.config.getPublic()
      .then((value) => {
        cachedConfig = value;
        return value;
      })
      .finally(() => { pendingConfig = null; });
  }
  return pendingConfig;
}

export function usePublicConfig() {
  const [value, setValue] = useState(cachedConfig || EMPTY_CONFIG);
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    let active = true;
    getPublicConfig()
      .then((next) => { if (active) setValue(next); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { config: value, loading };
}
