import { useEffect } from 'react';

/**
 * Registers a `beforeunload` event handler when `isDirty` is true,
 * showing the browser's native "Leave page?" confirmation dialog.
 * Cleans up the handler when `isDirty` becomes false or on unmount.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
