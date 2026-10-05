import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
/**
 * False during server rendering and until React takes over in the browser. Forms keep
 * submit disabled until then, so input typed on a slow load is never submitted unhandled.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
