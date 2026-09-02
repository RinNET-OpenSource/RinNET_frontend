import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 游戏图片/字体 CDN（等价旧版 environment.assetsHost） */
export const assetsHost = import.meta.env.VITE_ASSETS_HOST ?? 'https://rinnet.stehp.cn/';

/** 图片开关（等价旧版 environment.enableImages） */
export const enableImages = import.meta.env.VITE_ENABLE_IMAGES !== 'false';

/** 是否运行在 iframe 中（夺舍模式，见旧版 account.service.ts） */
export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
