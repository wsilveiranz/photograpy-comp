/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Azure Functions backend. Defaults to `/api`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
