import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createStore } from '@/lib/store';
import en from '@/i18n/en.json';
import zh from '@/i18n/zh.json';

/** 等价旧版 language.service.ts + ngx-translate（直接复用原 en/zh 资源，{{}} 插值兼容） */

export const languages = new Map<string, string>([
  ['en', 'English'],
  ['zh', '简体中文'],
]);
export const languageKeys = [...languages.keys()];

export function getDefaultLang(): string {
  let userLang = languageKeys[0];
  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    const baseLang = lang.split('-')[0];
    if (languageKeys.includes(baseLang)) {
      userLang = baseLang;
      break;
    }
  }
  return userLang;
}

export function getCurrentLang(): string {
  const currentLang = localStorage.getItem('lang') ?? '';
  if (languageKeys.includes(currentLang)) {
    return currentLang;
  }
  return getDefaultLang();
}

export const langStore = createStore<string>(getCurrentLang());

export function setLang(lang: string) {
  localStorage.setItem('lang', lang);
  langStore.set(getCurrentLang());
  void i18next.changeLanguage(getCurrentLang());
}

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getCurrentLang(),
  fallbackLng: 'en',
  interpolation: {
    // ngx-translate 与 i18next 默认都是 {{var}}，无需修改
    escapeValue: false,
  },
});
