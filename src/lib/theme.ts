import { useSyncExternalStore } from 'react';
import {
  getThemeFamily,
  isThemeFamily,
  type ThemeFamily,
} from '@/lib/theme-catalog';

export type { ThemeFamily } from '@/lib/theme-catalog';

export type ColorTheme = 'auto' | 'light' | 'dark';
export type ResolvedColorTheme = Exclude<ColorTheme, 'auto'>;

export interface ThemeSnapshot {
  readonly family: ThemeFamily;
  readonly colorTheme: ColorTheme;
  readonly resolvedColorTheme: ResolvedColorTheme;
}

export type ThemeChange = Readonly<{
  family?: ThemeFamily;
  colorTheme?: ColorTheme;
}>;

const DEFAULT_FAMILY: ThemeFamily = 'liquefy';
const DEFAULT_COLOR_THEME: ColorTheme = 'auto';
const listeners = new Set<() => void>();

let installed = false;
let mediaQuery: MediaQueryList | null = null;
let snapshot: ThemeSnapshot = Object.freeze({
  family: DEFAULT_FAMILY,
  colorTheme: DEFAULT_COLOR_THEME,
  resolvedColorTheme: 'light',
});

function isColorTheme(value: unknown): value is ColorTheme {
  return value === 'auto' || value === 'light' || value === 'dark';
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or hardened browser contexts.
  }
}

function resolveColorTheme(colorTheme: ColorTheme): ResolvedColorTheme {
  if (colorTheme !== 'auto') return colorTheme;
  return mediaQuery?.matches ? 'dark' : 'light';
}

function updateMetaTag(name: string, content: string) {
  let metaTag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.name = name;
    document.head.appendChild(metaTag);
  }
  metaTag.content = content;
}

function applyDocumentTheme(next: ThemeSnapshot) {
  document.documentElement.dataset.theme = next.family;
  document.documentElement.dataset.colorScheme = next.resolvedColorTheme;
  // Compatibility output only. RinNET, Tailwind and themes consume data-color-scheme.
  document.documentElement.dataset.bsTheme = next.resolvedColorTheme;

  const statusBar = getThemeFamily(next.family).statusBar[next.resolvedColorTheme];
  updateMetaTag('theme-color', statusBar);
  updateMetaTag(
    'apple-mobile-web-app-status-bar-style',
    next.resolvedColorTheme === 'dark' ? 'black' : 'default',
  );
}

function publish(next: ThemeSnapshot) {
  applyDocumentTheme(next);
  snapshot = Object.freeze(next);
  listeners.forEach((listener) => listener());
}

function storedTheme(): ThemeSnapshot {
  const storedFamily = readStorage('themeFamily');
  const storedColorTheme = readStorage('colorTheme');
  const family = storedFamily === 'modern'
    ? 'liquefy'
    : isThemeFamily(storedFamily) ? storedFamily : DEFAULT_FAMILY;
  const colorTheme = isColorTheme(storedColorTheme) ? storedColorTheme : DEFAULT_COLOR_THEME;
  if (storedFamily !== null && storedFamily !== family) writeStorage('themeFamily', family);
  if (storedColorTheme !== null && storedColorTheme !== colorTheme) {
    writeStorage('colorTheme', colorTheme);
  }
  return {
    family,
    colorTheme,
    resolvedColorTheme: resolveColorTheme(colorTheme),
  };
}

function onSystemThemeChange() {
  if (snapshot.colorTheme !== 'auto') return;
  publish({ ...snapshot, resolvedColorTheme: resolveColorTheme('auto') });
}

function onStorageChange(event: StorageEvent) {
  if (event.key !== 'themeFamily' && event.key !== 'colorTheme') return;
  publish(storedTheme());
}

/** Install the document theme before React mounts. Repeated calls are safe. */
export function installTheme() {
  if (installed) return;
  installed = true;
  mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  publish(storedTheme());
  mediaQuery?.addEventListener('change', onSystemThemeChange);
  window.addEventListener('storage', onStorageChange);
}

export function useTheme(): ThemeSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

/** Commit family/mode, DOM attributes, status-bar metadata and persistence as one transaction. */
export function setTheme(change: ThemeChange): ThemeSnapshot {
  installTheme();
  if (change.family === undefined && change.colorTheme === undefined) {
    throw new TypeError('A theme change must include family or colorTheme.');
  }
  if (change.family !== undefined && !isThemeFamily(change.family)) {
    throw new TypeError(`Unknown theme family: ${String(change.family)}`);
  }
  if (change.colorTheme !== undefined && !isColorTheme(change.colorTheme)) {
    throw new TypeError(`Unknown color theme: ${String(change.colorTheme)}`);
  }

  const family = change.family ?? snapshot.family;
  const colorTheme = change.colorTheme ?? snapshot.colorTheme;
  const next = {
    family,
    colorTheme,
    resolvedColorTheme: resolveColorTheme(colorTheme),
  } satisfies ThemeSnapshot;

  applyDocumentTheme(next);
  if (change.family !== undefined) writeStorage('themeFamily', family);
  if (change.colorTheme !== undefined) writeStorage('colorTheme', colorTheme);
  snapshot = Object.freeze(next);
  listeners.forEach((listener) => listener());
  return snapshot;
}
