/**
 * Laufzeit-Konfiguration der Client-App.
 *
 * Wird aus `public/config.json` (nach dem Build: `dist/config.json`) geladen,
 * sodass die Server-Adresse ohne Rebuild angepasst werden kann.
 *
 * `apiBaseUrl`:
 *   - ""                          -> gleicher Host wie der Client (Dev: Vite-Proxy auf /api)
 *   - "http://192.168.1.50:4000"  -> Server-App auf einem separaten Rechner
 */
export interface AppConfig {
  apiBaseUrl: string;
}

const DEFAULT_CONFIG: AppConfig = {
  apiBaseUrl: '',
};

let configPromise: Promise<AppConfig> | null = null;

function normalizeBaseUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

export function loadConfig(): Promise<AppConfig> {
  if (!configPromise) {
    configPromise = fetch(`${import.meta.env.BASE_URL}config.json`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) return DEFAULT_CONFIG;
        const raw = (await res.json()) as Partial<AppConfig>;
        return { apiBaseUrl: normalizeBaseUrl(raw.apiBaseUrl) };
      })
      .catch((err: unknown) => {
        console.warn(
          'config.json konnte nicht geladen werden, verwende Standardwerte.',
          err,
        );
        return DEFAULT_CONFIG;
      });
  }
  return configPromise;
}
