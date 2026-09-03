export interface Shot {
  shotNumber: number;
  teiler: number; // "Teiler" = deviation from center, lower is better
  timestamp: string;
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  // shots grouped by day (date in YYYY-MM-DD)
  shotsByDay: Record<string, Shot[]>;
}

export interface EventDay {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Tag 1 - 12.07.2026"
}

export interface EventData {
  eventName: string;
  rangeName: string;
  days: EventDay[];
  participants: Participant[];
}
