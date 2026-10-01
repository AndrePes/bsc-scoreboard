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
 * Fasst die Ranglisten mehrerer Tage zu einer Gesamt-Rangliste zusammen –
 * nach derselben Regel wie der Server für "Alle Tage":
 *
 * - Hat ein Teilnehmer an mehreren Tagen geschossen, zählt pro Tag nur der
 *   Tagesbestwert; Bester und Zweiter sind die zwei kleinsten Tagesbestwerte
 *   (immer von verschiedenen Tagen).
 * - Hat er nur an einem Tag geschossen, gelten bester und zweitbester Schuss
 *   dieses Tages.
 */
export function mergeRankings(
  days: DayParticipantsResponse[],
): ParticipantListEntry[] {
  const byId = new Map<
    string,
    { entry: ParticipantListEntry; perDay: ParticipantListEntry[]; count: number }
  >();

  for (const day of days) {
    for (const p of day.participants) {
      const existing = byId.get(p.id);
      if (existing) {
        existing.perDay.push(p);
        existing.count += p.teilerCount;
        existing.entry = {
          ...existing.entry,
          firstName: p.firstName,
          lastName: p.lastName,
          club: p.club ?? existing.entry.club,
        };
      } else {
        byId.set(p.id, { entry: p, perDay: [p], count: p.teilerCount });
      }
    }
  }

  return rankBySum(
    [...byId.values()].map(({ entry, perDay, count }) => {
      let best: { teiler: number; date: string };
      let second: { teiler: number; date: string } | null;

      if (perDay.length === 1) {
        const only = perDay[0];
        best = { teiler: only.bestTeiler, date: only.bestTeilerDate };
        second =
          only.secondBestTeiler === null
            ? null
            : {
                teiler: only.secondBestTeiler,
                date: only.secondBestTeilerDate ?? only.bestTeilerDate,
              };
      } else {
        const dayBests = perDay
          .map((d) => ({ teiler: d.bestTeiler, date: d.bestTeilerDate }))
          .sort((a, b) => a.teiler - b.teiler || a.date.localeCompare(b.date));
        best = dayBests[0];
        second = dayBests[1];
      }

      return {
        ...entry,
        bestTeiler: best.teiler,
        bestTeilerDate: best.date,
        secondBestTeiler: second?.teiler ?? null,
        secondBestTeilerDate: second?.date ?? null,
        teilerSum: second === null ? null : round2(best.teiler + second.teiler),
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
