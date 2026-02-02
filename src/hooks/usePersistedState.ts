import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that persists state in sessionStorage to prevent data loss
 * when switching tabs, windows, or navigating away temporarily.
 * 
 * @param key - Unique key for sessionStorage
 * @param initialValue - Default value if nothing is stored
 * @returns [state, setState] tuple like useState
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Initialize state from sessionStorage or use initial value
  const [state, setState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
    }
    return initialValue;
  });

  // Persist to sessionStorage whenever state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error writing sessionStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Hook to clear persisted state when component unmounts intentionally
 * (e.g., after successful submission)
 */
export function useClearPersistedState(key: string) {
  return useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Error removing sessionStorage key "${key}":`, error);
    }
  }, [key]);
}
