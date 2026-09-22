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
  /** Zweitbester Teiler, null bei nur einem Schuss. */
  secondBestTeiler: number | null;
  /** Summe aus bestem und zweitbestem Teiler, null wenn kein zweiter Schuss. */
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

export interface ParticipantDetail {
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  selectedDay: string | null;
  selectedDayStats: StatPair;
  allDaysStats: StatPair;
}
