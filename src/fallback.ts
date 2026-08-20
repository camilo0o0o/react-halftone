import { useEffect, useRef } from 'react';
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
 *
 * The callback is held in a ref rather than listed as a dependency: callers
 * pass inline arrows, whose identity changes every render, and depending on it
 * would refire on each parent re-render — and loop forever if the handler sets
 * state. Only an actual status/error change fires it.
 */
export function useOnError(
  status: HalftoneStatus,
  error: Error | null,
  onError?: (error: Error) => void
): void {
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (status === 'error' && error) onErrorRef.current?.(error);
  }, [status, error]);
}
