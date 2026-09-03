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
  totalShots: number;
}

function shotsForDay(p: Participant, day: string | null): Shot[] {
  if (!day) return p.shotsByDay ? Object.values(p.shotsByDay).flat() : [];
  return p.shotsByDay[day] ?? [];
}

function computeBestTeiler(shots: Shot[]): number {
  if (shots.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...shots.map((s) => s.teiler));
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
    .map(({ p, shots }) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      club: p.club,
      rank: 0,
      bestTeiler: computeBestTeiler(shots),
      totalShots: shots.length,
    }))
    .sort((a, b) => a.bestTeiler - b.bestTeiler)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const allShots = participantsWithShots.flatMap(({ shots }) => shots);
  const sortedTeilers = allShots.map((s) => s.teiler).sort((a, b) => a - b);
  const top3 = sortedTeilers.slice(0, 3);

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
