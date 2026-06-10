/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_CORE?: string;
  readonly VITE_API_DATA?: string;
  readonly VITE_API_AUDIT?: string;
  readonly VITE_USE_PROXY?: string;
  readonly VITE_CB_FAILURE_THRESHOLD?: string;
  readonly VITE_CB_RESET_MS?: string;
  readonly VITE_CB_HALF_OPEN_SUCCESSES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
