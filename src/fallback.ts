import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { HalftoneFallback } from './types';
import type { HalftoneStatus } from './core/types';

/**
 * Resolve a `fallback` prop (static node or render function) for the current
 * status/error. Returns null when no fallback was provided.
 */
export function resolveFallback(
  fallback: HalftoneFallback | undefined,
  status: HalftoneStatus,
  error: Error | null
): ReactNode {
  if (fallback === undefined) return null;
  return typeof fallback === 'function' ? fallback(status, error) : fallback;
}

/**
 * Invoke `onError` once whenever the component enters the error state.
 */
export function useOnError(
  status: HalftoneStatus,
  error: Error | null,
  onError?: (error: Error) => void
): void {
  useEffect(() => {
    if (status === 'error' && error && onError) onError(error);
  }, [status, error, onError]);
}
