import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

type Style = 'light' | 'dark';

// Screens that must keep a fixed status bar (Feed and the photo preview are
// always dark) push a style while focused. Focus-based rather than a mounted
// <StatusBar>: tab screens stay mounted after you leave them.
const forced: Style[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** The style the top-most focused screen forces, if any. */
export function useForcedStatusBarStyle(): Style | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return forced[forced.length - 1];
}

/** Forces `style` (status bar content colour) while the screen is focused. */
export function useStatusBarStyle(style: Style) {
  useFocusEffect(
    useCallback(() => {
      forced.push(style);
      emit();
      return () => {
        const i = forced.lastIndexOf(style);
        if (i !== -1) forced.splice(i, 1);
        emit();
      };
    }, [style]),
  );
}
