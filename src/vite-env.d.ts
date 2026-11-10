/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_PRODUCT_NAME__: string;

interface Window {
  hsTechDesktop?: {
    isDesktop: true;
    version: string;
    platform: string;
    getGeminiKeyStatus: () => Promise<{ configured: boolean; secureStorageAvailable: boolean }>;
    saveGeminiApiKey: (key: string) => Promise<{ saved: boolean; secureStorageAvailable: boolean }>;
    clearGeminiApiKey: () => Promise<{ cleared: boolean }>;
    selectMediaFiles: () => Promise<string[]>;
    getMcpConfig: () => Promise<{ available: boolean; config: string; executable?: string; error?: string }>;
    openLogsFolder: () => Promise<{ opened: boolean }>;
    openExternal: (url: string) => Promise<{ opened: boolean }>;
  };
}
