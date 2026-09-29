---
title: REST-API
---

# REST-API

Basis-URL: `http://<server>:4000/api`. Alle Endpunkte sind `GET`, antworten
mit `application/json` und erlauben CORS für alle Origins. Es gibt keine
Authentifizierung.

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| `GET` | [`/api/event`](#get-apievent) | Veranstaltungs-Metadaten und alle Tage |
| `GET` | [`/api/event/days/:date/participants`](#get-apieventdaysdateparticipants) | Statistik und Rangliste eines Tages |
| `GET` | [`/api/event/all/participants`](#get-apieventallparticipants) | Statistik und Rangliste über alle Tage |
| `GET` | [`/api/participants/:id`](#get-apiparticipantsid) | Detailstatistik eines Teilnehmers |
| `GET` | [`/api/health`](#get-apihealth) | Health-Check |

Alle Teiler-Werte sind in **1/100 mm** mit einer Nachkommastelle angegeben;
kleiner ist besser.

## Gemeinsame Typen

```ts
interface EventDay {
  date: string;   // "YYYY-MM-DD" oder "all"
  label: string;  // "Tag 1 - 04.09.2026" oder "Alle Tage"
}

interface TopTeiler {
  teiler: number;
  participantId: string;
  firstName: string;
  lastName: string;
}

interface ParticipantListEntry {
  id: string;                        // MemberId
  firstName: string;
  lastName: string;
  club?: string;                     // fehlt, wenn kein Verein hinterlegt
  rank: number;                      // 1-basiert, nach bestTeiler aufsteigend
  bestTeiler: number;
  secondBestTeiler: number | null;   // null bei nur einem Wert
  teilerSum: number | null;          // best + second, null bei nur einem Wert
  teilerCount: number;               // Anzahl gewerteter Teiler-Werte
}

interface DayStats {
  participantCount: number;
  bestTeiler: TopTeiler | null;
  secondBestTeiler: TopTeiler | null;
  thirdBestTeiler: TopTeiler | null;
}

interface DayParticipantsResponse {
  day: EventDay;
  stats: DayStats;
  participants: ParticipantListEntry[];
}
```

---

## `GET /api/event`

Metadaten der Veranstaltung und Liste aller Veranstaltungstage (aus den
Zeitstempeln der Dateien abgeleitet, aufsteigend sortiert).

**Antwort `200`**

```json
{
  "eventName": "BSC ScoreBoard",
  "rangeName": "Schießanlage BSC",
  "days": [
    { "date": "2026-09-04", "label": "Tag 1 - 04.09.2026" }
  ]
}
```

---

## `GET /api/event/days/:date/participants`

Tagesstatistik und sortierte Teilnehmerliste für einen Tag.

| Parameter | Ort | Beschreibung |
| --- | --- | --- |
| `date` | Pfad | Tag im Format `YYYY-MM-DD`; muss exakt einem abgeleiteten Tag entsprechen |

**Antwort `200`** (`DayParticipantsResponse`)

```json
{
  "day": { "date": "2026-09-04", "label": "Tag 1 - 04.09.2026" },
  "stats": {
    "participantCount": 42,
    "bestTeiler":       { "teiler": 12.3, "participantId": "179016", "firstName": "Bernd", "lastName": "Meyer" },
    "secondBestTeiler": { "teiler": 15.8, "participantId": "170068", "firstName": "Anna",  "lastName": "Schulz" },
    "thirdBestTeiler":  { "teiler": 18.0, "participantId": "179016", "firstName": "Bernd", "lastName": "Meyer" }
  },
  "participants": [
    {
      "id": "179016",
      "firstName": "Bernd",
      "lastName": "Meyer",
      "rank": 1,
      "bestTeiler": 12.3,
      "secondBestTeiler": 18.0,
      "teilerSum": 30.3,
      "teilerCount": 6
    }
  ]
}
```

**Fehler `404`**

```json
{ "error": "Day not found" }
```

Hinweise:

- Nur Teilnehmer mit mindestens einem Teiler an diesem Tag sind enthalten.
- `participants` ist nach `bestTeiler` aufsteigend sortiert; `rank` entspricht
  der Position. Bei Gleichstand entscheidet die Reihenfolge des ersten
  Auftretens (frühester Zeitstempel).
- Die drei `stats`-Werte sind die drei kleinsten Teiler des Tages über alle
  Teilnehmer; derselbe Schütze kann mehrfach vorkommen.

---

## `GET /api/event/all/participants`

Wie der Tages-Endpunkt, jedoch über **alle Tage** aggregiert. Pro Teilnehmer
werden alle Teiler aller Tage zusammengefasst.

**Antwort `200`** (`DayParticipantsResponse`) mit

```json
"day": { "date": "all", "label": "Alle Tage" }
```

Der Client verwendet den Sentinel `'all'` als ausgewählten Tag für diesen
Endpunkt.

---

## `GET /api/participants/:id`

Detailstatistik eines Teilnehmers für einen optionalen Tag sowie über alle
Tage.

| Parameter | Ort | Beschreibung |
| --- | --- | --- |
| `id` | Pfad | `MemberId` des Teilnehmers |
| `date` | Query (optional) | Tag `YYYY-MM-DD`; unbekannte Werte liefern leere Tagesstatistik |

**Antwort `200`**

```json
{
  "id": "179016",
  "firstName": "Bernd",
  "lastName": "Meyer",
  "selectedDay": "2026-09-04",
  "selectedDayStats": { "bestTeiler": 12.3, "teilerCount": 6 },
  "allDaysStats":     { "bestTeiler": 12.3, "teilerCount": 9 }
}
```

```ts
interface ParticipantDetail {
  id: string;
  firstName: string;
  lastName: string;
  club?: string;
  selectedDay: string | null;                  // Echo von ?date, sonst null
  selectedDayStats: { bestTeiler: number | null; teilerCount: number };
  allDaysStats:     { bestTeiler: number | null; teilerCount: number };
}
```

Ohne `date` (oder mit `date=all`) ist `selectedDayStats`
`{ "bestTeiler": null, "teilerCount": 0 }`.

**Fehler `404`**

```json
{ "error": "Participant not found" }
```

---

## `GET /api/health`

Health-Check mit Informationen zum geladenen Datenbestand.

**Antwort `200`**

```json
{
  "status": "ok",
  "dataDir": "/pfad/zu/server/data/raw",
  "todayDir": "/pfad/zu/server/data/raw/20260929/Exercise/raw",
  "watchDir": "/pfad/zu/server/data/raw/20260929/Exercise/raw",
  "files": 67,
  "participants": 42
}
```

| Feld | Bedeutung |
| --- | --- |
| `dataDir` | aufgelöster absoluter Pfad der Export-Wurzel (`config.json` → `dataDir`) |
| `todayDir` | erwarteter Ordner des heutigen Tages (`<dataDir>/<YYYYMMDD>/<daySubDir>`) |
| `watchDir` | aktuell überwachter Ordner; `null`, solange die Anlage den heutigen Tagesordner noch nicht angelegt hat |
| `files` | Anzahl aktuell geladener Dateien aller Tage (vor Duplikat-Bereinigung) |
| `participants` | Anzahl unterschiedlicher `MemberId`s |

---

## Fehlerverhalten

- Unbekannte Pfade liefern die Express-Standard-404-Seite (HTML).
- Es gibt keinen globalen Fehler-Handler; unerwartete Ausnahmen führen zur
  Express-Standardantwort `500`.
- Die Frontends werfen bei `!res.ok` einen Fehler mit Statuscode und -text
  (Client: `Request failed: 404 Not Found`, Live-Board:
  `Anfrage fehlgeschlagen: 404 Not Found`).

## Beispiele mit `curl`

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/event
curl http://localhost:4000/api/event/days/2026-09-04/participants
curl http://localhost:4000/api/event/all/participants
curl "http://localhost:4000/api/participants/179016?date=2026-09-04"
```
