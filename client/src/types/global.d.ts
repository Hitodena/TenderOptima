declare global {
  interface Window {
    refreshImprovementCounts?: () => void;
  }

  interface ImportMetaEnv {
    readonly VITE_ONBOARDING_ENABLED?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};