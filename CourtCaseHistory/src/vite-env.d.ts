/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COURTLIVESTREAM_URL?: string;
  readonly VITE_ANDROID_APP_URL?: string;
  readonly VITE_IOS_APP_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
