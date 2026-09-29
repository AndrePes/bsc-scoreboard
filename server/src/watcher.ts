import fs from 'node:fs/promises';
import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import type { ServerConfig } from './config.js';
import { ParseError, parseExerciseResult } from './parser.js';
import type { DataStore } from './store.js';

const FILE_PATTERN = /\.json$/i;
/** Tagesordner der Anlage: YYYYMMDD */
const DAY_DIR_PATTERN = /^\d{8}$/;
/** Wartezeit nach einem Lesefehler (z. B. Datei noch nicht fertig geschrieben). */
const RETRY_DELAY_MS = 500;
const MAX_ATTEMPTS = 3;
/**
 * Intervall, in dem geprüft wird, ob der Tag gewechselt hat oder der
 * heutige Tagesordner inzwischen von der Anlage angelegt wurde.
 */
const DAY_CHECK_INTERVAL_MS = 5_000;

/** Laufender File-Monitor. */
export interface FileMonitor {
  /** Aktuell überwachter Ordner oder `null`, wenn er noch nicht existiert. */
  readonly watchDir: string | null;
  /** Ordner des heutigen Tages (existiert evtl. noch nicht). */
  readonly todayDir: string;
  close(): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Heutiges Datum in lokaler Zeit als YYYYMMDD. */
export function todayDirName(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Vollständiger Pfad zu den JSON-Dateien eines Tagesordners. */
export function dayDataDir(config: ServerConfig, dayName: string): string {
  return path.join(config.dataDir, dayName, config.daySubDir);
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
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

/** Liest alle JSON-Dateien eines Ordners ein; liefert [geladen, gesamt]. */
async function loadDir(
  store: DataStore,
  dir: string,
): Promise<[ok: number, total: number]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && FILE_PATTERN.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
  let ok = 0;
  for (const file of files) {
    if (await loadFile(store, file, 'Geladen', false)) ok++;
  }
  return [ok, files.length];
}

/**
 * Liest beim Start die Dateien aller Tagesordner `<dataDir>/YYYYMMDD/<daySubDir>`.
 */
async function loadAllDays(config: ServerConfig, store: DataStore) {
  const entries = await fs.readdir(config.dataDir, { withFileTypes: true });
  const dayNames = entries
    .filter((e) => e.isDirectory() && DAY_DIR_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort();

  let okTotal = 0;
  let fileTotal = 0;
  let dirCount = 0;
  for (const dayName of dayNames) {
    const dir = dayDataDir(config, dayName);
    if (!(await isDirectory(dir))) {
      console.warn(`[monitor] Tagesordner ${dayName}: ${dir} nicht gefunden, übersprungen`);
      continue;
    }
    const [ok, total] = await loadDir(store, dir);
    console.log(`[monitor] Tag ${dayName}: ${ok} von ${total} Datei(en) geladen`);
    okTotal += ok;
    fileTotal += total;
    dirCount++;
  }
  console.log(
    `[monitor] Initial ${okTotal} von ${fileTotal} Datei(en) aus ${dirCount} Tagesordner(n) unter ${config.dataDir} geladen`,
  );
}

/**
 * Überwacht einen einzelnen Ordner. Mit `emitExisting` werden bereits
 * vorhandene Dateien über die `add`-Events geladen (kein Race zwischen
 * Verzeichnislesen und Watcher-Start).
 */
async function watchDir(
  config: ServerConfig,
  store: DataStore,
  dir: string,
  emitExisting: boolean,
): Promise<FSWatcher> {
  let ready = false;
  const watcher = watch(dir, {
    persistent: true,
    ignoreInitial: !emitExisting,
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
    .on('add', (filePath) =>
      void loadFile(store, filePath, ready ? 'Neu' : 'Geladen', ready),
    )
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
  ready = true;
  console.log(
    `[monitor] Überwache ${dir}` +
      (config.usePolling
        ? ` (Polling, ${config.pollingIntervalMs} ms)`
        : ' (Dateisystem-Events)'),
  );
  return watcher;
}

/**
 * Startet den File-Monitor.
 *
 * - Beim Start werden die Dateien aller Tagesordner unter `config.dataDir`
 *   geladen (`<dataDir>/YYYYMMDD/<daySubDir>/*.json`).
 * - Überwacht wird nur der Ordner des heutigen Tages. Existiert er noch
 *   nicht (die Anlage legt ihn beim ersten Durchgang an), wird periodisch
 *   nachgesehen und der Watcher gestartet, sobald er erscheint.
 * - Beim Tageswechsel wird auf den neuen Tagesordner umgeschaltet.
 */
export async function startFileMonitor(
  config: ServerConfig,
  store: DataStore,
): Promise<FileMonitor> {
  await fs.mkdir(config.dataDir, { recursive: true });
  await loadAllDays(config, store);

  let currentDay = todayDirName();
  let watcher: FSWatcher | null = null;
  let watchedDir: string | null = null;
  let waitingLogged = false;
  let switching = false;
  let closed = false;

  const stopWatcher = async () => {
    if (!watcher) return;
    const w = watcher;
    watcher = null;
    watchedDir = null;
    await w.close();
  };

  /** Startet den Watcher für `currentDay`, wenn der Ordner existiert. */
  const ensureWatcher = async (emitExisting: boolean) => {
    if (closed || watcher) return;
    const dir = dayDataDir(config, currentDay);
    if (!(await isDirectory(dir))) {
      if (!waitingLogged) {
        console.log(
          `[monitor] Tagesordner ${dir} existiert noch nicht, warte auf die Schießanlage …`,
        );
        waitingLogged = true;
      }
      return;
    }
    waitingLogged = false;
    const w = await watchDir(config, store, dir, emitExisting);
    if (closed) {
      await w.close();
      return;
    }
    watcher = w;
    watchedDir = dir;
  };

  // Beim Start wurden alle Tage bereits geladen -> vorhandene Dateien nicht erneut melden.
  await ensureWatcher(false);

  const tick = async () => {
    if (closed || switching) return;
    switching = true;
    try {
      const today = todayDirName();
      if (today !== currentDay) {
        console.log(`[monitor] Tageswechsel ${currentDay} -> ${today}`);
        await stopWatcher();
        currentDay = today;
        waitingLogged = false;
      }
      // Ordner ist evtl. erst jetzt erschienen: vorhandene Dateien mitnehmen.
      await ensureWatcher(true);
    } catch (err) {
      console.error('[monitor] Fehler beim Prüfen des Tagesordners:', err);
    } finally {
      switching = false;
    }
  };

  const timer = setInterval(() => void tick(), DAY_CHECK_INTERVAL_MS);
  // Der Timer soll den Prozess nicht am Beenden hindern (Server hält ihn offen).
  timer.unref();

  return {
    get watchDir() {
      return watchedDir;
    },
    get todayDir() {
      return dayDataDir(config, currentDay);
    },
    async close() {
      closed = true;
      clearInterval(timer);
      await stopWatcher();
    },
  };
}
