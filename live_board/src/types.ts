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
  /** Tag (YYYY-MM-DD) des besten Teilers. */
  bestTeilerDate: string;
  /**
   * Zweitbester Teiler, null bei nur einem Wert. Über mehrere Tage der
   * zweitkleinste Teiler im gesamten Zeitraum (kann vom selben Tag stammen).
   */
  secondBestTeiler: number | null;
  /** Tag des zweitbesten Teilers, null wenn kein zweiter Wert. */
  secondBestTeilerDate: string | null;
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
  /** Rangliste, aufsteigend nach Summe (bester + zweitbester Teiler), rank ab 1. */
  ranking: ParticipantListEntry[];
  loadedAt: Date;
}
