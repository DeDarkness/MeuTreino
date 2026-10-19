import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
export function useReducedMotion(preference = false): boolean {
  const system = useSyncExternalStore(subscribe, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
  return preference || system;
}
