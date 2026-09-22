// API-Antwortformen der Server-App (siehe server/src/index.ts).

export interface EventDay {
  date: string;
  label: string;
}

export interface EventInfo {
  eventName: string;
  rangeName: string;
  days: EventDay[];
}

export interface ParticipantListEntry {
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  rank: number;
  bestTeiler: number;
  /** Zweitbester Teiler, null bei nur einem Wert. */
  secondBestTeiler: number | null;
  /** Summe aus bestem und zweitbestem Teiler, null wenn kein zweiter Wert. */
  teilerSum: number | null;
  /** Anzahl gewerteter Teiler-Werte. */
  teilerCount: number;
}

export interface TopTeiler {
  teiler: number;
  participantId: string;
  firstName: string;
  lastName: string;
}

export interface DayStats {
  participantCount: number;
  bestTeiler: TopTeiler | null;
  secondBestTeiler: TopTeiler | null;
  thirdBestTeiler: TopTeiler | null;
}

export interface DayParticipantsResponse {
  day: EventDay;
  stats: DayStats;
  participants: ParticipantListEntry[];
}

/** Aufbereitete Daten für die Live-Ansicht. */
export interface LiveBoardData {
  eventName: string;
  rangeName: string;
  /** Beschreibung des angezeigten Zeitraums, z. B. "Alle Tage". */
  periodLabel: string;
  /** Rangliste, aufsteigend nach bestem Teiler, rank ab 1. */
  ranking: ParticipantListEntry[];
  loadedAt: Date;
}
