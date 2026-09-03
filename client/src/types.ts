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
  totalShots: number;
}

export interface DayStats {
  participantCount: number;
  bestTeiler: number | null;
  secondBestTeiler: number | null;
  thirdBestTeiler: number | null;
}

export interface DayParticipantsResponse {
  day: EventDay;
  stats: DayStats;
  participants: ParticipantListEntry[];
}

export interface StatPair {
  bestTeiler: number | null;
  worstTeiler: number | null;
  shotCount: number;
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
