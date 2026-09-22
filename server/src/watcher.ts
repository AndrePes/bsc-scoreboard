import fs from 'node:fs/promises';
import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import type { ServerConfig } from './config.js';
import { ParseError, parseExerciseResult } from './parser.js';
import type { DataStore } from './store.js';

const FILE_PATTERN = /\.json$/i;
/** Wartezeit nach einem Lesefehler (z. B. Datei noch nicht fertig geschrieben). */
const RETRY_DELAY_MS = 500;
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonWithRetry(filePath: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      return JSON.parse(text) as unknown;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

/**
 * Liest eine Datei, parst sie und legt sie im Store ab.
 * Liefert `true`, wenn die Datei übernommen wurde.
 */
async function loadFile(
  store: DataStore,
  filePath: string,
  label: string,
  verbose: boolean,
): Promise<boolean> {
  const name = path.basename(filePath);
  try {
    const json = await readJsonWithRetry(filePath);
    const session = parseExerciseResult(json, filePath);
    store.upsert(session);
    if (verbose) {
      console.log(
        `[monitor] ${label}: ${name} -> ` +
          `${session.firstName} ${session.lastName} (${session.memberId}), ` +
          `${session.date}, Teiler ${session.teilers.join(' / ')}`,
      );
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const kind = err instanceof ParseError ? 'übersprungen' : 'Lesefehler';
    console.warn(`[monitor] ${name} ${kind}: ${msg}`);
    // Eine evtl. vorher geladene Version dieser Datei nicht weiterverwenden.
    store.remove(filePath);
    return false;
  }
}

/** Liest alle vorhandenen Dateien im Quell-Ordner ein. */
async function loadExisting(config: ServerConfig, store: DataStore) {
  const entries = await fs.readdir(config.dataDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && FILE_PATTERN.test(e.name))
    .map((e) => path.join(config.dataDir, e.name))
    .sort();
  let ok = 0;
  for (const file of files) {
    if (await loadFile(store, file, 'Geladen', false)) ok++;
  }
  console.log(
    `[monitor] Initial ${ok} von ${files.length} Datei(en) aus ${config.dataDir} geladen`,
  );
}

/**
 * Startet den File-Monitor für `config.dataDir`:
 * vorhandene Dateien werden sofort geladen, danach werden neue, geänderte
 * und gelöschte Dateien laufend in den Store übernommen.
 */
export async function startFileMonitor(
  config: ServerConfig,
  store: DataStore,
): Promise<FSWatcher> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await loadExisting(config, store);

  const watcher = watch(config.dataDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    usePolling: config.usePolling,
    interval: config.pollingIntervalMs,
    // Erst reagieren, wenn die Datei eine Weile nicht mehr wächst,
    // damit halb geschriebene Dateien nicht gelesen werden.
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    ignored: (filePath, stats) =>
      !!stats?.isFile() && !FILE_PATTERN.test(filePath),
  });

  watcher
    .on('add', (filePath) => void loadFile(store, filePath, 'Neu', true))
    .on('change', (filePath) =>
      void loadFile(store, filePath, 'Geändert', true),
    )
    .on('unlink', (filePath) => {
      if (store.remove(filePath)) {
        console.log(`[monitor] Entfernt: ${path.basename(filePath)}`);
      }
    })
    .on('error', (err) => console.error('[monitor] Fehler:', err));

  await new Promise<void>((resolve) => watcher.once('ready', resolve));
  console.log(
    `[monitor] Überwache ${config.dataDir}` +
      (config.usePolling
        ? ` (Polling, ${config.pollingIntervalMs} ms)`
        : ' (Dateisystem-Events)'),
  );
  return watcher;
}
