import { createStore } from '@/lib/store';

/** 等价旧版 theme.service.ts：data-bs-theme 属性切换 + localStorage['colorTheme'] + 状态栏 meta */

export type Theme = 'dark' | 'light' | 'auto';

const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function initialTheme(): Theme {
  const saved = localStorage.getItem('colorTheme') as Theme | null;
  return saved ?? 'auto';
}

export const themeStore = createStore<Theme>(initialTheme());

function applyColorTheme() {
  const theme = themeStore.get();
  const isDarkMode = theme === 'dark' || (theme === 'auto' && themeMediaQuery.matches);
  document.documentElement.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');
  setStatusBarColor(isDarkMode);
}

function setStatusBarColor(isDarkMode: boolean) {
  // Android（与旧版一致的颜色）
  updateMetaTag('theme-color', isDarkMode ? '#202020' : '#f3f3f3');
  // iOS
  updateMetaTag('apple-mobile-web-app-status-bar-style', isDarkMode ? 'black' : 'default');
}

function updateMetaTag(name: string, content: string) {
  let metaTag = document.querySelector(`meta[name="${name}"]`);
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute('name', name);
    document.head.appendChild(metaTag);
  }
  metaTag.setAttribute('content', content);
}

export function setTheme(newTheme: Theme) {
  themeStore.set(newTheme);
  localStorage.setItem('colorTheme', newTheme);
  applyColorTheme();
}

export function getTheme(): Theme {
  return themeStore.get();
}

export function initTheme() {
  applyColorTheme();
  themeMediaQuery.addEventListener('change', () => {
    if (themeStore.get() === 'auto') {
      applyColorTheme();
    }
  });
}
