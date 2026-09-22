import express from 'express';
import cors from 'cors';
import { eventData } from './data.js';
import type { EventDay, Participant, Shot } from './types.js';

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
  /** Zweitbester Teiler des Teilnehmers, null bei nur einem Schuss. */
  secondBestTeiler: number | null;
  /** Summe aus bestem und zweitbestem Teiler, null wenn kein zweiter Schuss. */
  teilerSum: number | null;
  totalShots: number;
}

/** Ein Top-Teiler des Tages inkl. Schütze. */
interface TopTeiler {
  teiler: number;
  participantId: string;
  firstName: string;
  lastName: string;
}

function shotsForDay(p: Participant, day: string | null): Shot[] {
  if (!day) return p.shotsByDay ? Object.values(p.shotsByDay).flat() : [];
  return p.shotsByDay[day] ?? [];
}

function computeBestTeiler(shots: Shot[]): number {
  if (shots.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...shots.map((s) => s.teiler));
}

/** Teiler aufsteigend sortiert (niedriger = besser). */
function sortedTeilers(shots: Shot[]): number[] {
  return shots.map((s) => s.teiler).sort((a, b) => a - b);
}

app.get('/api/event', (_req, res) => {
  res.json({
    eventName: eventData.eventName,
    rangeName: eventData.rangeName,
    days: eventData.days,
  });
});

function buildDayResponse(dayShotsLookup: (p: Participant) => Shot[], day: EventDay | null) {
  const participantsWithShots = eventData.participants
    .map((p) => ({ p, shots: dayShotsLookup(p) }))
    .filter((entry) => entry.shots.length > 0);

  const stats: ParticipantStats[] = participantsWithShots
    .map(({ p, shots }) => {
      const teilers = sortedTeilers(shots);
      const bestTeiler = computeBestTeiler(shots);
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
        totalShots: shots.length,
      };
    })
    .sort((a, b) => a.bestTeiler - b.bestTeiler)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  // Die drei besten Einzelschüsse des Tages über alle Teilnehmer, inkl. Schütze.
  const top3: TopTeiler[] = participantsWithShots
    .flatMap(({ p, shots }) =>
      shots.map((s) => ({
        teiler: s.teiler,
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
  const day = eventData.days.find((d) => d.date === date);
  if (!day) {
    return res.status(404).json({ error: 'Day not found' });
  }
  res.json(buildDayResponse((p) => p.shotsByDay[date] ?? [], day));
});

app.get('/api/event/all/participants', (_req, res) => {
  const allDays: EventDay = { date: 'all', label: 'Alle Tage' };
  res.json(
    buildDayResponse((p) => Object.values(p.shotsByDay).flat(), allDays),
  );
});

app.get('/api/participants/:id', (req, res) => {
  const id = req.params.id;
  const date = (req.query.date as string | undefined) ?? null;
  const participant = eventData.participants.find((p) => p.id === id);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const allShots: Shot[] = Object.values(participant.shotsByDay).flat();
  const dayShots: Shot[] = date ? participant.shotsByDay[date] ?? [] : [];

  function stats(shots: Shot[]) {
    if (shots.length === 0) {
      return { bestTeiler: null, worstTeiler: null, shotCount: 0 };
    }
    const teilers = shots.map((s) => s.teiler);
    return {
      bestTeiler: Math.min(...teilers),
      worstTeiler: Math.max(...teilers),
      shotCount: shots.length,
    };
  }

  res.json({
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    club: participant.club,
    selectedDay: date,
    selectedDayStats: stats(dayShots),
    allDaysStats: stats(allShots),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`BSC ScoreBoard Server listening on http://localhost:${PORT}`);
});
