/**
 * Laufzeit-Konfiguration des Live-Boards.
 *
 * Wird aus `public/config.json` (nach dem Build: `dist/config.json`) geladen,
 * sodass alle Werte ohne Rebuild angepasst werden können.
 */
export interface LiveBoardConfig {
  /**
   * Adresse der Server-App, z. B. "http://192.168.1.50:4000".
   * Leer = gleicher Host wie das Live-Board (Dev: Vite-Proxy auf /api).
   */
  apiBaseUrl: string;
  /**
   * Anzuzeigende Veranstaltungstage (YYYY-MM-DD).
   * Leeres Array = alle Tage der Veranstaltung.
   */
  dates: string[];
  /** Intervall der Datenaktualisierung in Sekunden. */
  refreshIntervalSec: number;
  /** Scrollgeschwindigkeit der Tabelle in Pixel pro Sekunde. */
  scrollSpeedPxPerSec: number;
  /** Pause in Sekunden am Anfang und am Ende der Tabelle. */
  scrollPauseSec: number;
  /** Anzahl gleichzeitig sichtbarer Tabellenzeilen. */
  visibleRows: number;
}

export const DEFAULT_CONFIG: LiveBoardConfig = {
  apiBaseUrl: '',
  dates: [],
  refreshIntervalSec: 60,
  scrollSpeedPxPerSec: 24,
  scrollPauseSec: 3,
  visibleRows: 6,
};

let configPromise: Promise<LiveBoardConfig> | null = null;

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = positiveNumber(value, fallback);
  return Math.max(1, Math.round(n));
}

function dateList(value: unknown): string[] {
  if (typeof value === 'string') value = [value];
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is string => typeof d === 'string')
    .map((d) => d.trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

function normalize(raw: Partial<Record<keyof LiveBoardConfig, unknown>>) {
  return {
    apiBaseUrl: str(raw.apiBaseUrl, '').replace(/\/+$/, ''),
    dates: dateList(raw.dates),
    refreshIntervalSec: positiveNumber(
      raw.refreshIntervalSec,
      DEFAULT_CONFIG.refreshIntervalSec,
    ),
    scrollSpeedPxPerSec: positiveNumber(
      raw.scrollSpeedPxPerSec,
      DEFAULT_CONFIG.scrollSpeedPxPerSec,
    ),
    scrollPauseSec:
      typeof raw.scrollPauseSec === 'number' && raw.scrollPauseSec >= 0
        ? raw.scrollPauseSec
        : DEFAULT_CONFIG.scrollPauseSec,
    visibleRows: positiveInt(raw.visibleRows, DEFAULT_CONFIG.visibleRows),
  } satisfies LiveBoardConfig;
}

export function loadConfig(): Promise<LiveBoardConfig> {
  if (!configPromise) {
    configPromise = fetch(`${import.meta.env.BASE_URL}config.json`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) return DEFAULT_CONFIG;
        return normalize((await res.json()) as Record<string, unknown>);
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
