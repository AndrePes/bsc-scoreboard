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
   * Zweitbester Teiler, null bei nur einem Wert. In der Gesamtansicht bei
   * mehreren Tagen der zweitbeste Tagesbestwert (anderer Tag als bestTeiler).
   */
  secondBestTeiler: number | null;
  /** Tag des zweitbesten Teilers, null wenn kein zweiter Wert. */
  secondBestTeilerDate: string | null;
  /** Summe aus bestem und zweitbestem Teiler, null wenn kein zweiter Wert. */
  teilerSum: number | null;
  /** Anzahl gewerteter Teiler-Werte. */
  teilerCount: number;
}

/** Ein Top-Teiler des Tages inkl. Schütze. */
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

export interface StatPair {
  bestTeiler: number | null;
  teilerCount: number;
}

/** Gesamtwertung über alle Tage (gleiche Regel wie die Gesamt-Rangliste). */
export interface AllDaysStats extends StatPair {
  bestTeilerDate: string | null;
  secondBestTeiler: number | null;
  secondBestTeilerDate: string | null;
  teilerSum: number | null;
}

/** Bestwerte eines Teilnehmers an einem Tag. */
export interface ParticipantDayStats {
  date: string;
  label: string;
  bestTeiler: number;
  secondBestTeiler: number | null;
  teilerCount: number;
}

export interface ParticipantDetail {
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  selectedDay: string | null;
  selectedDayStats: StatPair;
  allDaysStats: AllDaysStats;
  /** Tage mit Werten, chronologisch. */
  days: ParticipantDayStats[];
}
