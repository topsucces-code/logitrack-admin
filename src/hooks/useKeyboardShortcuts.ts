import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsConfig {
  /** Called when Ctrl+K / Cmd+K or "/" is pressed (focus search) */
  onSearch?: () => void;
  /** Called when Escape is pressed (close modal, clear focus, etc.) */
  onEscape?: () => void;
  /** Called when "?" is pressed (show shortcuts help) */
  onHelp?: () => void;
}

/**
 * Hook that registers global keyboard shortcuts for the admin dashboard.
 *
 * Shortcuts:
 * - Ctrl+K / Cmd+K : Focus search input
 * - /              : Focus search input (when not in an input/textarea)
 * - Escape         : Close modal / blur active element
 * - ?              : Show keyboard shortcuts help (when not in an input/textarea)
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig = {}) {
  const { onSearch, onEscape, onHelp } = config;

  const isInInput = useCallback(() => {
    const tag = document.activeElement?.tagName.toLowerCase();
    const isContentEditable = document.activeElement?.getAttribute('contenteditable') === 'true';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || isContentEditable;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // Escape: close modal or blur
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      // Skip "/" and "?" if user is already typing in an input
      if (isInInput()) return;

      // "/": focus search
      if (e.key === '/') {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // "?": show shortcuts help
      if (e.key === '?') {
        e.preventDefault();
        onHelp?.();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSearch, onEscape, onHelp, isInInput]);
}
