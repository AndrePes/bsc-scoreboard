import type {
  RawExerciseResultData,
  RawParameterResult,
  SessionResult,
} from './types.js';

/**
 * Umrechnung Meter -> Teiler.
 * Die Anlage liefert den Abstand vom Zentrum in Metern; ein "Teiler"
 * entspricht 1/100 mm. 0.00034177 m -> 34.2 Teiler.
 */
const METERS_TO_TEILER = 100_000;

function metersToTeiler(meters: number): number {
  return Math.round(meters * METERS_TO_TEILER * 10) / 10;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ParseError(`Feld "${field}" fehlt oder ist kein String`);
  }
  return value;
}

/**
 * Wählt das Teiler-Ergebnis aus `ParameterResults`. In den Exporten ist das
 * ein Array mit einem Eintrag vom Typ "Bester Teiler"; ein einzelnes Objekt
 * wird ebenfalls akzeptiert.
 */
function pickParameterResult(
  value: RawExerciseResultData['ParameterResults'],
): RawParameterResult {
  const list: unknown[] = Array.isArray(value) ? value : value ? [value] : [];
  const candidates = list.filter(
    (entry): entry is RawParameterResult =>
      isObject(entry) && Array.isArray(entry.Teilers),
  );
  if (candidates.length === 0) {
    throw new ParseError('ParameterResults.Teilers fehlt');
  }
  return (
    candidates.find((c) => c.ParameterResultType === 'Bester Teiler') ??
    candidates[0]
  );
}

/** "2026-09-04T18:43:35.819+02:00" -> "2026-09-04" (lokales Datum der Anlage). */
function dateFromTimestamp(timestamp: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(timestamp);
  if (match) return match[1];
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new ParseError(`Ungültiger Zeitstempel "${timestamp}"`);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Wandelt den Inhalt einer `*_ExerciseResultData.json` in ein `SessionResult`.
 * Wirft `ParseError`, wenn Pflichtfelder fehlen.
 */
export function parseExerciseResult(
  json: unknown,
  sourceFile: string,
): SessionResult {
  if (!isObject(json)) {
    throw new ParseError('Dateiinhalt ist kein JSON-Objekt');
  }
  const raw = json as unknown as RawExerciseResultData;

  const userData = raw.UserSessionInformation?.UserData;
  if (!isObject(userData)) {
    throw new ParseError('UserSessionInformation.UserData fehlt');
  }

  const memberId = requireString(
    userData.MemberId,
    'UserSessionInformation.UserData.MemberId',
  ).trim();
  if (memberId === '') {
    throw new ParseError('MemberId ist leer');
  }
  const firstName = (
    typeof userData.FirstName === 'string' ? userData.FirstName : ''
  ).trim();
  const lastName = (
    typeof userData.Name === 'string' ? userData.Name : ''
  ).trim();
  const club =
    typeof userData.Club === 'string' && userData.Club.trim() !== ''
      ? userData.Club.trim()
      : undefined;

  if (!raw.LastShot || typeof raw.LastShot !== 'object') {
    throw new ParseError('LastShot fehlt');
  }
  const timestamp = requireString(raw.LastShot.TimeStamp, 'LastShot.TimeStamp');
  const date = dateFromTimestamp(timestamp);

  const parameterResult = pickParameterResult(raw.ParameterResults);
  const teilers = parameterResult.Teilers.filter(
    (t): t is number => typeof t === 'number' && Number.isFinite(t) && t >= 0,
  )
    .map(metersToTeiler)
    .sort((a, b) => a - b);

  const id =
    typeof raw.Id === 'string' && raw.Id.trim() !== ''
      ? raw.Id.trim()
      : `${memberId}@${timestamp}`;

  return {
    id,
    memberId,
    firstName,
    lastName,
    club,
    date,
    timestamp,
    teilers,
    sourceFile,
  };
}
