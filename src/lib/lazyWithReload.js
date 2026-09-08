import { lazy } from 'react';

const RETRY_KEY = 'rootminster_chunk_reload';
const CHUNK_ERROR = /(?:Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|ChunkLoadError)/i;

function isChunkLoadError(error) {
  return CHUNK_ERROR.test(String(error?.message || error || ''));
}

/**
 * Recover once when a deployment replaces a hashed bundle while somebody still
 * has the previous index open. A successful import clears the guard so later
 * deployments can recover in the same browser session too.
 */
export function lazyWithReload(importer) {
  return lazy(async () => {
    try {
      const module = await importer();
      window.sessionStorage.removeItem(RETRY_KEY);
      return module;
    } catch (error) {
      const locationKey = `${window.location.pathname}${window.location.search}`;
      if (isChunkLoadError(error) && window.sessionStorage.getItem(RETRY_KEY) !== locationKey) {
        window.sessionStorage.setItem(RETRY_KEY, locationKey);
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
