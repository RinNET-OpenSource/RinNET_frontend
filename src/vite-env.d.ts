/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** 游戏图片/字体 CDN（等价旧版 environment.assetsHost） */
  readonly VITE_ASSETS_HOST?: string;
  /** 图片开关（等价旧版 environment.enableImages） */
  readonly VITE_ENABLE_IMAGES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
