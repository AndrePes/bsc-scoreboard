import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { DataStore } from './store.js';
import { startFileMonitor, type FileMonitor } from './watcher.js';
import type { EventDay, Participant, TeilerResult } from './types.js';

const config = loadConfig();
const store = new DataStore(config.eventName, config.rangeName);

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

interface ParticipantStats {
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  /** Position nach Sortierung: teilerSum aufsteigend, ohne Summe am Ende. */
  rank: number;
  bestTeiler: number;
  /** Tag (YYYY-MM-DD), an dem der beste Teiler geschossen wurde. */
  bestTeilerDate: string;
  /** Zweitbester Teiler des Teilnehmers, null bei nur einem Wert. */
  secondBestTeiler: number | null;
  /** Tag des zweitbesten Teilers, null wenn kein zweiter Wert. */
  secondBestTeilerDate: string | null;
  /** Summe aus bestem und zweitbestem Teiler, null wenn kein zweiter Wert. */
  teilerSum: number | null;
  /** Anzahl gewerteter Teiler-Werte. */
  teilerCount: number;
}

/** Ein Top-Teiler des Tages inkl. Schütze. */
interface TopTeiler {
  teiler: number;
  participantId: string;
  firstName: string;
  lastName: string;
}

/** Ein Teiler-Wert mit dem Tag, an dem er geschossen wurde. */
interface DatedTeiler {
  teiler: number;
  date: string;
}

/** Bester und zweitbester Teiler eines Teilnehmers für den betrachteten Zeitraum. */
interface BestTwo {
  best: DatedTeiler;
  second: DatedTeiler | null;
}

function computeBestTeiler(results: TeilerResult[]): number {
  if (results.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...results.map((r) => r.teiler));
}

/** Teiler aufsteigend sortiert (niedriger = besser). */
function sortedTeilers(results: TeilerResult[]): number[] {
  return results.map((r) => r.teiler).sort((a, b) => a - b);
}

function allTeilers(p: Participant): TeilerResult[] {
  return Object.values(p.teilersByDay).flat();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sortierreihenfolge der Rangliste: Summe aus bestem und zweitbestem Teiler,
 * aufsteigend (kleiner = besser). Teilnehmer ohne zweiten Teiler (keine Summe)
 * kommen ans Ende; bei Gleichstand entscheidet der bessere Einzel-Teiler.
 */
function compareBySum(a: ParticipantStats, b: ParticipantStats): number {
  if (a.teilerSum === null && b.teilerSum === null) {
    return a.bestTeiler - b.bestTeiler;
  }
  if (a.teilerSum === null) return 1;
  if (b.teilerSum === null) return -1;
  return a.teilerSum - b.teilerSum || a.bestTeiler - b.bestTeiler;
}

/** Nur die Tage mit mindestens einem Wert, nach Datum sortiert. */
function daysWithResults(
  byDay: Record<string, TeilerResult[]>,
): Array<[date: string, results: TeilerResult[]]> {
  return Object.entries(byDay)
    .filter(([, results]) => results.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Ermittelt besten und zweitbesten Teiler über den gesamten übergebenen
 * Zeitraum: Es zählen die zwei kleinsten Einzelwerte aller Tage, unabhängig
 * davon, an welchem Tag sie geschossen wurden (auch beide vom selben Tag).
 */
function pickBestTwo(byDay: Record<string, TeilerResult[]>): BestTwo | null {
  const all: DatedTeiler[] = daysWithResults(byDay)
    .flatMap(([date, results]) => results.map((r) => ({ teiler: r.teiler, date })))
    .sort((a, b) => a.teiler - b.teiler || a.date.localeCompare(b.date));
  if (all.length === 0) return null;
  return { best: all[0], second: all[1] ?? null };
}

app.get('/api/event', (_req, res) => {
  const data = store.getEventData();
  res.json({
    eventName: data.eventName,
    rangeName: data.rangeName,
    days: data.days,
  });
});

/**
 * Baut die Antwort für einen Tag oder alle Tage.
 * `lookup` liefert die zu wertenden Teiler des Teilnehmers, gruppiert nach Tag.
 */
function buildDayResponse(
  lookup: (p: Participant) => Record<string, TeilerResult[]>,
  day: EventDay | null,
) {
  const participantsWithResults = store
    .getEventData()
    .participants.map((p) => {
      const byDay = lookup(p);
      return { p, byDay, results: Object.values(byDay).flat() };
    })
    .filter((entry) => entry.results.length > 0);

  const stats: ParticipantStats[] = participantsWithResults
    .map(({ p, byDay, results }) => {
      // results.length > 0 ist oben sichergestellt, daher nie null.
      const { best, second } = pickBestTwo(byDay)!;
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        club: p.club,
        rank: 0,
        bestTeiler: best.teiler,
        bestTeilerDate: best.date,
        secondBestTeiler: second?.teiler ?? null,
        secondBestTeilerDate: second?.date ?? null,
        teilerSum: second === null ? null : round2(best.teiler + second.teiler),
        teilerCount: results.length,
      };
    })
    .sort(compareBySum)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  // Die drei besten Teiler des Tages über alle Teilnehmer, inkl. Schütze.
  const top3: TopTeiler[] = participantsWithResults
    .flatMap(({ p, results }) =>
      results.map((r) => ({
        teiler: r.teiler,
        participantId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
      })),
    )
    .sort((a, b) => a.teiler - b.teiler)
    .slice(0, 3);

  return {
    day,
    stats: {
      participantCount: stats.length,
      bestTeiler: top3[0] ?? null,
      secondBestTeiler: top3[1] ?? null,
      thirdBestTeiler: top3[2] ?? null,
    },
    participants: stats,
  };
}

app.get('/api/event/days/:date/participants', (req, res) => {
  const date = req.params.date;
  const day = store.getEventData().days.find((d) => d.date === date);
  if (!day) {
    return res.status(404).json({ error: 'Day not found' });
  }
  res.json(
    buildDayResponse((p) => ({ [date]: p.teilersByDay[date] ?? [] }), day),
  );
});

app.get('/api/event/all/participants', (_req, res) => {
  const allDays: EventDay = { date: 'all', label: 'Alle Tage' };
  res.json(buildDayResponse((p) => p.teilersByDay, allDays));
});

app.get('/api/participants/:id', (req, res) => {
  const id = req.params.id;
  const date = (req.query.date as string | undefined) ?? null;
  const participant = store
    .getEventData()
    .participants.find((p) => p.id === id);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const dayResults: TeilerResult[] = date
    ? participant.teilersByDay[date] ?? []
    : [];

  function stats(results: TeilerResult[]) {
    if (results.length === 0) {
      return { bestTeiler: null, teilerCount: 0 };
    }
    return {
      bestTeiler: computeBestTeiler(results),
      teilerCount: results.length,
    };
  }

  // Gesamtwertung nach derselben Regel wie /api/event/all/participants.
  const overall = pickBestTwo(participant.teilersByDay);
  const allDaysStats = {
    ...stats(allTeilers(participant)),
    bestTeilerDate: overall?.best.date ?? null,
    secondBestTeiler: overall?.second?.teiler ?? null,
    secondBestTeilerDate: overall?.second?.date ?? null,
    teilerSum:
      overall?.second != null
        ? round2(overall.best.teiler + overall.second.teiler)
        : null,
  };

  // Bestwerte pro Tag (nur Tage mit Werten), chronologisch.
  const dayLabels = new Map(
    store.getEventData().days.map((d) => [d.date, d.label] as const),
  );
  const days = daysWithResults(participant.teilersByDay).map(
    ([dayDate, results]) => {
      const sorted = sortedTeilers(results);
      return {
        date: dayDate,
        label: dayLabels.get(dayDate) ?? dayDate,
        bestTeiler: sorted[0],
        secondBestTeiler: sorted[1] ?? null,
        teilerCount: results.length,
      };
    },
  );

  res.json({
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    club: participant.club,
    selectedDay: date,
    selectedDayStats: stats(dayResults),
    allDaysStats,
    days,
  });
});

let monitor: FileMonitor | null = null;

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    dataDir: config.dataDir,
    /** Ordner des heutigen Tages (`<dataDir>/YYYYMMDD/<daySubDir>`). */
    todayDir: monitor?.todayDir ?? null,
    /** Aktuell überwachter Ordner; null, solange der Tagesordner fehlt. */
    watchDir: monitor?.watchDir ?? null,
    files: store.fileCount,
    participants: store.getEventData().participants.length,
  });
});

async function main() {
  monitor = await startFileMonitor(config, store);
  app.listen(PORT, () => {
    console.log(`BSC ScoreBoard Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Server konnte nicht gestartet werden:', err);
  process.exit(1);
});
