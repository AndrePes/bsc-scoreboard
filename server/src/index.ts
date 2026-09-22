import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { DataStore } from './store.js';
import { startFileMonitor } from './watcher.js';
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
  rank: number;
  bestTeiler: number;
  /** Zweitbester Teiler des Teilnehmers, null bei nur einem Wert. */
  secondBestTeiler: number | null;
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

app.get('/api/event', (_req, res) => {
  const data = store.getEventData();
  res.json({
    eventName: data.eventName,
    rangeName: data.rangeName,
    days: data.days,
  });
});

function buildDayResponse(
  lookup: (p: Participant) => TeilerResult[],
  day: EventDay | null,
) {
  const participantsWithResults = store
    .getEventData()
    .participants.map((p) => ({ p, results: lookup(p) }))
    .filter((entry) => entry.results.length > 0);

  const stats: ParticipantStats[] = participantsWithResults
    .map(({ p, results }) => {
      const teilers = sortedTeilers(results);
      const bestTeiler = computeBestTeiler(results);
      const secondBestTeiler = teilers[1] ?? null;
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        club: p.club,
        rank: 0,
        bestTeiler,
        secondBestTeiler,
        teilerSum:
          secondBestTeiler === null
            ? null
            : Math.round((bestTeiler + secondBestTeiler) * 100) / 100,
        teilerCount: results.length,
      };
    })
    .sort((a, b) => a.bestTeiler - b.bestTeiler)
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
  res.json(buildDayResponse((p) => p.teilersByDay[date] ?? [], day));
});

app.get('/api/event/all/participants', (_req, res) => {
  const allDays: EventDay = { date: 'all', label: 'Alle Tage' };
  res.json(buildDayResponse(allTeilers, allDays));
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

  res.json({
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    club: participant.club,
    selectedDay: date,
    selectedDayStats: stats(dayResults),
    allDaysStats: stats(allTeilers(participant)),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    dataDir: config.dataDir,
    files: store.fileCount,
    participants: store.getEventData().participants.length,
  });
});

async function main() {
  await startFileMonitor(config, store);
  app.listen(PORT, () => {
    console.log(`BSC ScoreBoard Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Server konnte nicht gestartet werden:', err);
  process.exit(1);
});
