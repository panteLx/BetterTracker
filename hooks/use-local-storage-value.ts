"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads a localStorage key as React state.
 *
 * localStorage is an external store, so it is subscribed to rather than copied
 * into state inside an effect: the server snapshot is `null`, the client reads
 * the real value on hydration, and no cascading render is needed to reconcile
 * the two. Writes go through `writeLocalStorageValue` so every hook reading the
 * same key updates, which the native `storage` event does not do for the tab
 * that performed the write.
 */

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useLocalStorageValue(key: string) {
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Private mode or blocked storage.
      return null;
    }
  }, [key]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function writeLocalStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the value just won't survive a reload.
  }

  for (const listener of listeners) {
    listener();
  }
}
