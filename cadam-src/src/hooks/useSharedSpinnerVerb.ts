import { useSyncExternalStore } from 'react';
import { pickSpinnerVerb, SPINNER_VERBS } from '@/constants/spinnerVerbs';

const VERB_ROTATE_MS = 2800;

let currentVerb = SPINNER_VERBS[0] ?? 'Thinking';
let rotateInterval: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function rotateVerb() {
  currentVerb = pickSpinnerVerb();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!rotateInterval) {
    rotateInterval = setInterval(rotateVerb, VERB_ROTATE_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && rotateInterval) {
      clearInterval(rotateInterval);
      rotateInterval = undefined;
    }
  };
}

function subscribeDisabled() {
  return () => {};
}

function getSnapshot() {
  return currentVerb;
}

export function useSharedSpinnerVerb(enabled = true) {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    getSnapshot,
    getSnapshot,
  );
}
