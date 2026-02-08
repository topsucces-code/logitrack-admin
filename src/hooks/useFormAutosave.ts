import { useEffect, useRef, useState, useCallback } from 'react';

interface DraftData<T> {
  data: T;
  savedAt: string;
}

interface UseFormAutosaveReturn<T> {
  hasDraft: boolean;
  restoreDraft: () => T | null;
  clearDraft: () => void;
  draftSavedAt: Date | null;
  justSaved: boolean;
}

export function useFormAutosave<T>(
  key: string,
  formData: T,
  isOpen: boolean
): UseFormAutosaveReturn<T> {
  const storageKey = `draft_${key}`;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const justSavedRef = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRender = useRef(true);

  // Check for existing draft when modal opens
  useEffect(() => {
    if (isOpen) {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed: DraftData<T> = JSON.parse(raw);
          setHasDraft(true);
          setDraftSavedAt(new Date(parsed.savedAt));
        } catch {
          sessionStorage.removeItem(storageKey);
          setHasDraft(false);
          setDraftSavedAt(null);
        }
      } else {
        setHasDraft(false);
        setDraftSavedAt(null);
      }
      isFirstRender.current = true;
    }
  }, [isOpen, storageKey]);

  // Debounced save on formData changes (skip initial render when modal opens)
  useEffect(() => {
    if (!isOpen) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const draft: DraftData<T> = {
        data: formData,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      setDraftSavedAt(new Date(draft.savedAt));
      setHasDraft(true);

      // Flash "just saved" indicator
      setJustSaved(true);
      if (justSavedRef.current) clearTimeout(justSavedRef.current);
      justSavedRef.current = setTimeout(() => setJustSaved(false), 2000);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formData, isOpen, storageKey]);

  const restoreDraft = useCallback((): T | null => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      const parsed: DraftData<T> = JSON.parse(raw);
      setHasDraft(false);
      return parsed.data;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setHasDraft(false);
    setDraftSavedAt(null);
  }, [storageKey]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (justSavedRef.current) clearTimeout(justSavedRef.current);
    };
  }, []);

  return { hasDraft, restoreDraft, clearDraft, draftSavedAt, justSaved };
}
