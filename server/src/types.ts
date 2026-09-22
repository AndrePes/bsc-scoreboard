// ---------------------------------------------------------------------------
// Rohformat der Schießanlage (`*_ExerciseResultData.json`, siehe /schema.json)
// Nur die tatsächlich verwendeten Felder sind typisiert.
// ---------------------------------------------------------------------------

export interface RawUserData {
  /** Teilnehmer-Nummer. */
  MemberId: string;
  /** Vorname. */
  FirstName: string;
  /** Nachname. */
  Name: string;
  DisplayName?: string;
  Club?: string;
}

export interface RawUserSessionInformation {
  SessionId?: string;
  UserData: RawUserData;
}

export interface RawParameterResult {
  /** Die besten Teiler (Abstand vom Zentrum in Metern), aufsteigend. */
  Teilers: number[];
  /** z. B. "Bester Teiler" */
  ParameterResultType?: string;
  ResultValid?: boolean;
}

export interface RawLastShot {
  /** ISO-8601 mit Zeitzonen-Offset, z. B. "2026-09-04T18:43:35.819+02:00" */
  TimeStamp: string;
  ShotNumber?: number;
}

export interface RawExerciseResultData {
  /** Eindeutige ID des Durchgangs (dient zur Duplikat-Erkennung). */
  Id?: string;
  UserSessionInformation: RawUserSessionInformation;
  /** In den Exporten ein Array; einzelne Objekte werden ebenfalls akzeptiert. */
  ParameterResults?: RawParameterResult[] | RawParameterResult | null;
  LastShot?: RawLastShot | null;
  RangeName?: string;
  ExerciseName?: string;
  FiringPoint?: number;
}

// ---------------------------------------------------------------------------
// Internes Modell
// ---------------------------------------------------------------------------

/**
 * Ein einzelner Teiler-Wert. Einheit: 1/100 mm (Schießsport-üblich),
 * umgerechnet aus `RadiusInM` der Anlage. Kleiner = besser.
 */
export interface TeilerResult {
  teiler: number;
  /** Zeitstempel des Durchgangs (LastShot.TimeStamp). */
  timestamp: string;
  /** ID des Durchgangs, aus dem der Wert stammt. */
  sessionId: string;
}

/** Ein ausgewerteter Durchgang = eine Datei der Schießanlage. */
export interface SessionResult {
  /** Eindeutige ID (Raw `Id`, sonst aus MemberId + Zeitstempel). */
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  club?: string;
  /** Tag des Durchgangs, YYYY-MM-DD (lokale Zeit der Anlage). */
  date: string;
  /** LastShot.TimeStamp */
  timestamp: string;
  /** Die besten Teiler in 1/100 mm, aufsteigend sortiert. */
  teilers: number[];
  /** Absoluter Pfad der Quelldatei. */
  sourceFile: string;
}

export interface Participant {
  /** = MemberId */
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  /** key = YYYY-MM-DD */
  teilersByDay: Record<string, TeilerResult[]>;
}

export interface EventDay {
  date: string; // YYYY-MM-DD
  label: string; // "Tag 1 - 04.09.2026"
}

export interface EventData {
  eventName: string;
  rangeName: string;
  days: EventDay[];
  participants: Participant[];
}
