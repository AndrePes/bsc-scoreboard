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
  id: string;                          // MemberId
  firstName: string;
  lastName: string;
  club?: string;                       // fehlt, wenn kein Verein hinterlegt
  rank: number;                        // 1-basiert, nach teilerSum aufsteigend
  bestTeiler: number;
  bestTeilerDate: string;              // Tag des besten Teilers (YYYY-MM-DD)
  secondBestTeiler: number | null;     // null bei nur einem Wert
  secondBestTeilerDate: string | null; // Tag des zweitbesten Teilers
  teilerSum: number | null;            // best + second, null bei nur einem Wert
  teilerCount: number;                 // Anzahl gewerteter Teiler-Werte
}
```

### Regel für Bester / 2. Teiler / Summe

| Sicht | `bestTeiler` | `secondBestTeiler` |
| --- | --- | --- |
| Ein Tag (`/days/:date/…`) | bester Schuss des Tages | zweitbester Schuss **desselben** Tages |
| Alle Tage (`/all/…`) | kleinster Teiler im gesamten Zeitraum | zweitkleinster Teiler im gesamten Zeitraum (kann vom selben Tag stammen) |

Beispiel: Tag 1: 10.0 und 23.5, Tag 2: 25.5 und 19.8 → Gesamtansicht:
10.0 (Tag 1) / 19.8 (Tag 2) / Summe 29.8.

```ts
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
      "bestTeilerDate": "2026-09-04",
      "secondBestTeiler": 18.0,
      "secondBestTeilerDate": "2026-09-04",
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
- `participants` ist nach `teilerSum` aufsteigend sortiert (kleiner = besser);
  Teilnehmer ohne Summe (nur ein Teiler) stehen am Ende, untereinander nach
  `bestTeiler`. Bei gleicher Summe entscheidet `bestTeiler`, danach die
  Reihenfolge des ersten Auftretens (frühester Zeitstempel). `rank`
  entspricht der Position.
- Die drei `stats`-Werte sind die drei kleinsten Teiler des Tages über alle
  Teilnehmer; derselbe Schütze kann mehrfach vorkommen.

---

## `GET /api/event/all/participants`

Wie der Tages-Endpunkt, jedoch über **alle Tage** aggregiert. `teilerCount`
und die Top-3-`stats` berücksichtigen alle Teiler aller Tage; `bestTeiler`,
`secondBestTeiler` und `teilerSum` folgen der Zeitraum-Regel (siehe
oben): die zwei kleinsten Teiler über alle Tage.

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
  "id": "1001",
  "firstName": "Marc",
  "lastName": "Valentin",
  "selectedDay": "2026-09-12",
  "selectedDayStats": { "bestTeiler": 29.9, "teilerCount": 3 },
  "allDaysStats": {
    "bestTeiler": 29.9,
    "teilerCount": 6,
    "bestTeilerDate": "2026-09-12",
    "secondBestTeiler": 43.9,
    "secondBestTeilerDate": "2026-09-14",
    "teilerSum": 73.8
  },
  "days": [
    { "date": "2026-09-12", "label": "Tag 1 - 12.09.2026", "bestTeiler": 29.9, "secondBestTeiler": 35.0, "teilerCount": 3 },
    { "date": "2026-09-14", "label": "Tag 2 - 14.09.2026", "bestTeiler": 43.9, "secondBestTeiler": 60.0, "teilerCount": 3 }
  ]
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
  allDaysStats: {
    bestTeiler: number | null;
    teilerCount: number;
    bestTeilerDate: string | null;             // Tag des besten Teilers
    secondBestTeiler: number | null;           // zweitkleinster Teiler im Zeitraum
    secondBestTeilerDate: string | null;
    teilerSum: number | null;
  };
  days: Array<{                                // Tage mit Werten, chronologisch
    date: string;
    label: string;                             // "Tag N - DD.MM.YYYY"
    bestTeiler: number;
    secondBestTeiler: number | null;
    teilerCount: number;
  }>;
}
```

`allDaysStats` wird nach derselben Regel berechnet wie die Gesamt-Rangliste
(`/api/event/all/participants`), sodass Rangliste und Details übereinstimmen.
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
