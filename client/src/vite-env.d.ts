/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AMAP_JS_KEY: string;
  readonly VITE_AMAP_JS_SECURITY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
