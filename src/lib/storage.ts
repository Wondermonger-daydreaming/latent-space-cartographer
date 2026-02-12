type LabelCorrection = {
  featureId: number;
  label: string;
};

const CORRECTION_KEY = 'cartographer:label-corrections';
const SESSION_KEY = 'cartographer:last-session';

export function loadCorrections(): Record<number, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CORRECTION_KEY);
    return raw ? (JSON.parse(raw) as Record<number, string>) : {};
  } catch (error) {
    console.warn('Unable to parse corrections', error);
    return {};
  }
}

export function saveCorrection(correction: LabelCorrection) {
  if (typeof window === 'undefined') return;
  const current = loadCorrections();
  current[correction.featureId] = correction.label;
  window.localStorage.setItem(CORRECTION_KEY, JSON.stringify(current));
}

export type SessionState = {
  concepts: { phrase: string; domain?: string }[];
  mode: string;
};

export function saveSession(state: SessionState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export function loadSession(): SessionState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionState) : null;
}
