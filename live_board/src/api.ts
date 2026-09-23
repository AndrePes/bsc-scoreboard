import type { LiveBoardConfig } from './config';
import type {
  DayParticipantsResponse,
  EventInfo,
  LiveBoardData,
  ParticipantListEntry,
} from './types';

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Anfrage fehlgeschlagen: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sortierreihenfolge des Live-Boards: Summe aus bestem und zweitbestem Teiler,
 * aufsteigend (kleiner = besser). Teilnehmer ohne zweiten Teiler (keine Summe)
 * kommen ans Ende; bei Gleichstand entscheidet der bessere Einzel-Teiler.
 */
function compareBySum(a: ParticipantListEntry, b: ParticipantListEntry) {
  if (a.teilerSum === null && b.teilerSum === null) {
    return a.bestTeiler - b.bestTeiler;
  }
  if (a.teilerSum === null) return 1;
  if (b.teilerSum === null) return -1;
  return a.teilerSum - b.teilerSum || a.bestTeiler - b.bestTeiler;
}

/** Sortiert nach Summe und vergibt die Ränge neu (1..n). */
export function rankBySum(
  entries: ParticipantListEntry[],
): ParticipantListEntry[] {
  return [...entries]
    .sort(compareBySum)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

/**
 * Fasst die Ranglisten mehrerer Tage zu einer Gesamt-Rangliste zusammen.
 * Da pro Tag der beste und zweitbeste Teiler bekannt sind, ergeben sich die
 * zwei besten Gesamt-Teiler eines Teilnehmers aus der Vereinigung dieser Werte.
 */
export function mergeRankings(
  days: DayParticipantsResponse[],
): ParticipantListEntry[] {
  const byId = new Map<
    string,
    { entry: ParticipantListEntry; teilers: number[]; count: number }
  >();

  for (const day of days) {
    for (const p of day.participants) {
      const teilers = [p.bestTeiler];
      if (p.secondBestTeiler !== null) teilers.push(p.secondBestTeiler);
      const existing = byId.get(p.id);
      if (existing) {
        existing.teilers.push(...teilers);
        existing.count += p.teilerCount;
        existing.entry = {
          ...existing.entry,
          firstName: p.firstName,
          lastName: p.lastName,
          club: p.club ?? existing.entry.club,
        };
      } else {
        byId.set(p.id, { entry: p, teilers, count: p.teilerCount });
      }
    }
  }

  return rankBySum(
    [...byId.values()].map(({ entry, teilers, count }) => {
      const sorted = [...teilers].sort((a, b) => a - b);
      const best = sorted[0];
      const second = sorted[1] ?? null;
      return {
        ...entry,
        bestTeiler: best,
        secondBestTeiler: second,
        teilerSum: second === null ? null : round2(best + second),
        teilerCount: count,
        rank: 0,
      };
    }),
  );
}

/** Lädt alle Daten für die Live-Ansicht gemäß Konfiguration. */
export async function loadLiveBoardData(
  config: LiveBoardConfig,
): Promise<LiveBoardData> {
  const base = config.apiBaseUrl;
  const event = await getJson<EventInfo>(base, '/event');

  let ranking: ParticipantListEntry[];
  let periodLabel: string;

  if (config.dates.length === 0) {
    const all = await getJson<DayParticipantsResponse>(
      base,
      '/event/all/participants',
    );
    ranking = rankBySum(all.participants);
    periodLabel = all.day.label;
  } else if (config.dates.length === 1) {
    const single = await getJson<DayParticipantsResponse>(
      base,
      `/event/days/${encodeURIComponent(config.dates[0])}/participants`,
    );
    ranking = rankBySum(single.participants);
    periodLabel = single.day.label;
  } else {
    const results = await Promise.all(
      config.dates.map((date) =>
        getJson<DayParticipantsResponse>(
          base,
          `/event/days/${encodeURIComponent(date)}/participants`,
        ).catch((err: Error) => {
          console.warn(`Tag ${date} konnte nicht geladen werden: ${err.message}`);
          return null;
        }),
      ),
    );
    const loaded = results.filter(
      (r): r is DayParticipantsResponse => r !== null,
    );
    ranking = mergeRankings(loaded);
    periodLabel = loaded.map((d) => d.day.label).join(' · ') || '–';
  }

  return {
    eventName: event.eventName,
    rangeName: event.rangeName,
    periodLabel,
    ranking,
    loadedAt: new Date(),
  };
}
