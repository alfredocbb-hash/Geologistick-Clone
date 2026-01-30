import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';

interface DraftData<T> {
  formData: T;
  savedAt: number;
}

interface UseFormDraftOptions {
  debounceMs?: number;
  expirationDays?: number;
}

interface UseFormDraftReturn<T> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  hasDraft: boolean;
  lastSaved: Date | null;
  clearDraft: () => void;
  discardDraft: () => void;
  isDraftRecovered: boolean;
  setIsDraftRecovered: (value: boolean) => void;
}

const DRAFT_PREFIX = 'form_draft_';
const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_EXPIRATION_DAYS = 7;

export function useFormDraft<T extends object>(
  formKey: string,
  initialValues: T,
  options: UseFormDraftOptions = {}
): UseFormDraftReturn<T> {
  const { user } = useAuth();
  const { debounceMs = DEFAULT_DEBOUNCE_MS, expirationDays = DEFAULT_EXPIRATION_DAYS } = options;
  
  const storageKey = `${DRAFT_PREFIX}${formKey}_${user?.id || 'anonymous'}`;
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);
  
  const [formData, setFormData] = useState<T>(initialValues);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDraftRecovered, setIsDraftRecovered] = useState(false);

  // Check if draft has meaningful data (not just empty initial values)
  const hasMeaningfulData = useCallback((data: T): boolean => {
    return Object.entries(data as Record<string, unknown>).some(([key, value]) => {
      const initialValue = (initialValues as Record<string, unknown>)[key];
      if (value === initialValue) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (typeof value === 'boolean' && value === false) return false;
      if (value === null || value === undefined) return false;
      return true;
    });
  }, [initialValues]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (isInitialized.current) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draftData: DraftData<T> = JSON.parse(stored);
        const now = Date.now();
        const expirationMs = expirationDays * 24 * 60 * 60 * 1000;
        
        // Check if draft is expired
        if (now - draftData.savedAt > expirationMs) {
          localStorage.removeItem(storageKey);
        } else if (hasMeaningfulData(draftData.formData)) {
          setFormData(draftData.formData);
          setHasDraft(true);
          setLastSaved(new Date(draftData.savedAt));
          setIsDraftRecovered(true);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      localStorage.removeItem(storageKey);
    }
    
    isInitialized.current = true;
  }, [storageKey, expirationDays, hasMeaningfulData]);

  // Save draft to localStorage with debounce
  useEffect(() => {
    if (!isInitialized.current) return;
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (hasMeaningfulData(formData)) {
        const draftData: DraftData<T> = {
          formData,
          savedAt: Date.now(),
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(draftData));
          setHasDraft(true);
          setLastSaved(new Date());
        } catch (error) {
          console.error('Error saving draft:', error);
        }
      } else {
        // Remove draft if no meaningful data
        localStorage.removeItem(storageKey);
        setHasDraft(false);
        setLastSaved(null);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formData, storageKey, debounceMs, hasMeaningfulData]);

  // Clear draft (called on successful save)
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSaved(null);
      setIsDraftRecovered(false);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [storageKey]);

  // Discard draft and reset to initial values
  const discardDraft = useCallback(() => {
    clearDraft();
    setFormData(initialValues);
  }, [clearDraft, initialValues]);

  return {
    formData,
    setFormData,
    hasDraft,
    lastSaved,
    clearDraft,
    discardDraft,
    isDraftRecovered,
    setIsDraftRecovered,
  };
}

// Utility to clean up old drafts
export function cleanupOldDrafts(maxAgeDays: number = 7): void {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const draftData = JSON.parse(stored);
            if (now - draftData.savedAt > maxAgeMs) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // If parsing fails, remove the corrupted item
          if (key) localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old drafts:', error);
  }
}
