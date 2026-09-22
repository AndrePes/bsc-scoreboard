import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Server-Konfiguration, gelesen aus `server/config.json`.
 *
 * Umgebungsvariablen überschreiben einzelne Werte:
 *   CONFIG_PATH  Pfad zu einer alternativen config.json
 *   DATA_DIR     Quell-Ordner für die Rohdaten der Schießanlage
 *   PORT         HTTP-Port (wird in index.ts ausgewertet)
 */
export interface ServerConfig {
  /** Quell-Ordner mit den `*_ExerciseResultData.json`-Dateien (absolut). */
  dataDir: string;
  /** Polling statt FS-Events verwenden (nötig z. B. für Netzlaufwerke/SMB). */
  usePolling: boolean;
  /** Polling-Intervall in ms (nur bei usePolling). */
  pollingIntervalMs: number;
  eventName: string;
  rangeName: string;
}

/** Wurzelverzeichnis der Server-App (Ordner, der `config.json` enthält). */
export const SERVER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const DEFAULTS: ServerConfig = {
  dataDir: path.join(SERVER_ROOT, 'data', 'raw'),
  usePolling: false,
  pollingIntervalMs: 1000,
  eventName: 'BSC ScoreBoard',
  rangeName: 'Schießanlage BSC',
};

type RawConfig = Partial<Record<keyof ServerConfig, unknown>>;

function readConfigFile(configPath: string): RawConfig {
  if (!fs.existsSync(configPath)) {
    console.warn(
      `[config] ${configPath} nicht gefunden, verwende Standardwerte.`,
    );
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('config.json muss ein JSON-Objekt enthalten');
    }
    return raw as RawConfig;
  } catch (err) {
    console.error(`[config] Fehler beim Lesen von ${configPath}:`, err);
    return {};
  }
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function loadConfig(): ServerConfig {
  const configPath = path.resolve(
    SERVER_ROOT,
    process.env.CONFIG_PATH ?? 'config.json',
  );
  const raw = readConfigFile(configPath);

  // Relative Pfade in config.json beziehen sich auf den Server-Root,
  // nicht auf das aktuelle Arbeitsverzeichnis.
  const dataDirRaw = process.env.DATA_DIR ?? str(raw.dataDir, DEFAULTS.dataDir);
  const dataDir = path.resolve(SERVER_ROOT, dataDirRaw);

  return {
    dataDir,
    usePolling: bool(raw.usePolling, DEFAULTS.usePolling),
    pollingIntervalMs: num(raw.pollingIntervalMs, DEFAULTS.pollingIntervalMs),
    eventName: str(raw.eventName, DEFAULTS.eventName),
    rangeName: str(raw.rangeName, DEFAULTS.rangeName),
  };
}
