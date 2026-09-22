import type {
  EventData,
  EventDay,
  Participant,
  SessionResult,
  TeilerResult,
} from './types.js';

/**
 * In-Memory-Store aller eingelesenen Durchgänge, geschlüsselt nach Quelldatei.
 * Der File-Monitor ruft `upsert`/`remove` auf; die API liest über `getEventData`.
 */
export class DataStore {
  private readonly sessionsByFile = new Map<string, SessionResult>();
  private cache: EventData | null = null;

  constructor(
    private readonly eventName: string,
    private readonly rangeName: string,
  ) {}

  upsert(session: SessionResult): void {
    this.sessionsByFile.set(session.sourceFile, session);
    this.cache = null;
  }

  remove(sourceFile: string): boolean {
    const removed = this.sessionsByFile.delete(sourceFile);
    if (removed) this.cache = null;
    return removed;
  }

  clear(): void {
    this.sessionsByFile.clear();
    this.cache = null;
  }

  get fileCount(): number {
    return this.sessionsByFile.size;
  }

  getEventData(): EventData {
    if (!this.cache) this.cache = this.build();
    return this.cache;
  }

  private build(): EventData {
    // Duplikate (gleiche Durchgangs-ID aus mehreren Dateien) nur einmal zählen.
    const sessionsById = new Map<string, SessionResult>();
    for (const session of this.sessionsByFile.values()) {
      const existing = sessionsById.get(session.id);
      if (!existing || session.sourceFile < existing.sourceFile) {
        sessionsById.set(session.id, session);
      }
    }
    const sessions = [...sessionsById.values()].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );

    const participantsById = new Map<string, Participant>();
    const dates = new Set<string>();

    for (const s of sessions) {
      dates.add(s.date);
      let participant = participantsById.get(s.memberId);
      if (!participant) {
        participant = {
          id: s.memberId,
          firstName: s.firstName,
          lastName: s.lastName,
          club: s.club,
          teilersByDay: {},
        };
        participantsById.set(s.memberId, participant);
      } else {
        // Neuester Durchgang gewinnt bei Namensänderungen.
        if (s.firstName) participant.firstName = s.firstName;
        if (s.lastName) participant.lastName = s.lastName;
        if (s.club) participant.club = s.club;
      }

      const entries: TeilerResult[] = s.teilers.map((teiler) => ({
        teiler,
        timestamp: s.timestamp,
        sessionId: s.id,
      }));
      (participant.teilersByDay[s.date] ??= []).push(...entries);
    }

    const days: EventDay[] = [...dates].sort().map((date, idx) => ({
      date,
      label: `Tag ${idx + 1} - ${formatGermanDate(date)}`,
    }));

    return {
      eventName: this.eventName,
      rangeName: this.rangeName,
      days,
      participants: [...participantsById.values()],
    };
  }
}

/** "2026-09-04" -> "04.09.2026" */
function formatGermanDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}
