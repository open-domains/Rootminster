import { scanAllObserverTargets } from '../observer.js';

export default async function () {
  const result = await scanAllObserverTargets();
  return Response.json({ success: true, result });
}
