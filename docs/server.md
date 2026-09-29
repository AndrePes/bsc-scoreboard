---
title: Server
---

# Server (`server/`)

Der Server (`bsc-scoreboard-server`) ist eine Express-Anwendung in TypeScript,
die den Datenordner der Schießanlage überwacht, die Ergebnisdateien einliest
und die Auswertung als JSON unter `/api` bereitstellt. Er hält alle Daten im
Speicher; es gibt keine Datenbank.

- Standard-Port: **4000** (Umgebungsvariable `PORT`)
- Konfiguration: `server/config.json` (siehe [Konfiguration](konfiguration.md))
- API-Referenz: [REST-API](api.md)

## Aufbau

```
server/
├── config.json          # Laufzeit-Konfiguration (Datenordner, Namen)
├── package.json         # ESM ("type": "module"), Skripte dev/build/start
├── tsconfig.json        # ES2022, strict, outDir dist
├── data/
│   ├── raw/             # 67 Beispieldateien der Anlage (ein Tag, 2026-09-04)
│   └── *.json           # ISSF-Format-Beispiele (werden übersprungen)
├── dist/                # Build-Ausgabe (tsc), nicht versioniert
└── src/
    ├── index.ts         # Einstieg: Express, Routen, Ranglisten-Berechnung
    ├── config.ts        # loadConfig(), SERVER_ROOT, Pfadauflösung
    ├── watcher.ts       # startFileMonitor(): Initial-Load + chokidar
    ├── parser.ts        # parseExerciseResult(): Rohdatei -> SessionResult
    ├── store.ts         # DataStore: In-Memory-Speicher mit Cache
    └── types.ts         # Rohformat + internes Modell
```

## Startablauf (`index.ts`)

1. `loadConfig()` liest `config.json` und Umgebungsvariablen.
2. `new DataStore(eventName, rangeName)` legt den leeren Store an.
3. Express-App mit `cors()` (alle Origins) und `express.json()`.
4. `await startFileMonitor(config, store)` – erst wenn alle vorhandenen
   Dateien geladen sind und der Watcher bereit ist, geht es weiter.
5. `app.listen(PORT)` – Log: `BSC ScoreBoard Server listening on http://localhost:4000`.

Schlägt der Start fehl (z. B. Datenordner nicht anlegbar), wird
`Server konnte nicht gestartet werden: …` protokolliert und der Prozess mit
Exit-Code 1 beendet.

## Konfiguration (`config.ts`)

`SERVER_ROOT` ist das Verzeichnis oberhalb des laufenden Moduls – sowohl bei
`tsx src/index.ts` als auch bei `node dist/index.js` also `server/`. Alle
relativen Pfade (`dataDir`, `CONFIG_PATH`) werden gegen `SERVER_ROOT`
aufgelöst, **nicht** gegen das aktuelle Arbeitsverzeichnis.

| Schlüssel | Standard | Prüfung |
| --- | --- | --- |
| `dataDir` | `server/data/raw` | nicht-leerer String |
| `usePolling` | `false` | Boolean |
| `pollingIntervalMs` | `1000` | Zahl > 0 |
| `eventName` | `BSC ScoreBoard` | nicht-leerer String |
| `rangeName` | `Schießanlage BSC` | nicht-leerer String |

Ungültige Werte fallen einzeln auf den Standard zurück; unbekannte Schlüssel
werden ignoriert. Fehlt die Datei: `[config] … nicht gefunden, verwende
Standardwerte.` Ist sie fehlerhaft: `[config] Fehler beim Lesen von …`.

Umgebungsvariablen: `CONFIG_PATH` (alternative Konfigurationsdatei),
`DATA_DIR` (überschreibt `dataDir`), `PORT` (HTTP-Port). Details in
[Konfiguration](konfiguration.md).

## File-Monitor (`watcher.ts`)

`startFileMonitor(config, store)`:

1. Legt `dataDir` an, falls nicht vorhanden (`mkdir -p`).
2. **Initial-Load:** liest alle regulären Dateien mit Endung `.json` im
   Ordner (sortiert), parst sie und legt sie im Store ab. Log:
   `[monitor] Initial <ok> von <n> Datei(en) aus <dataDir> geladen`.
3. Startet chokidar mit folgenden Optionen:

   | Option | Wert | Bedeutung |
   | --- | --- | --- |
   | `ignoreInitial` | `true` | Initial-Load erfolgt manuell (Schritt 2) |
   | `depth` | `0` | nur oberste Ebene, keine Unterordner |
   | `usePolling` | aus Config | Polling für Netzlaufwerke |
   | `interval` | `pollingIntervalMs` | Abfrageintervall beim Polling |
   | `awaitWriteFinish` | `{ stabilityThreshold: 500, pollInterval: 100 }` | wartet, bis die Datei 500 ms unverändert ist |
   | `ignored` | Funktion | ignoriert Dateien ohne `.json`-Endung |

4. Ereignisse:

   | Ereignis | Aktion | Log |
   | --- | --- | --- |
   | `add` | Datei lesen, parsen, `store.upsert()` | `[monitor] Neu: <datei> -> <Vorname> <Name> (<MemberId>), <Datum>, Teiler a / b / c` |
   | `change` | wie `add` | `[monitor] Geändert: …` |
   | `unlink` | `store.remove()` | `[monitor] Entfernt: <datei>` |
   | `error` | – | `[monitor] Fehler: …` |

5. Nach `ready`: `[monitor] Überwache <dataDir> (Dateisystem-Events)` bzw.
   `(Polling, <ms> ms)`.

**Lesen mit Wiederholung:** Jede Datei wird bis zu 3-mal gelesen (Wartezeit
500 ms, dann 1000 ms), um halb geschriebene Dateien abzufangen. Schlägt das
Parsen fehl (`ParseError`), erscheint `[monitor] <datei> übersprungen: <Grund>`;
bei I/O- oder JSON-Syntaxfehlern `[monitor] <datei> Lesefehler: <Grund>`. In
beiden Fällen wird ein eventuell vorhandener früherer Stand der Datei aus dem
Store entfernt.

## Parser (`parser.ts`)

`parseExerciseResult(json, sourceFile): SessionResult` bildet die Rohdatei auf
das interne Modell ab. Welche Felder gelesen werden, wie umgerechnet wird und
wann eine Datei übersprungen wird, ist in
[Datenformat der Schießanlage](datenformat.md) beschrieben.

Ergebnis:

```ts
interface SessionResult {
  id: string;          // Raw `Id`, sonst `${memberId}@${timestamp}`
  memberId: string;
  firstName: string;
  lastName: string;
  club?: string;
  date: string;        // YYYY-MM-DD
  timestamp: string;   // LastShot.TimeStamp
  teilers: number[];   // 1/100 mm, aufsteigend
  sourceFile: string;  // absoluter Pfad
}
```

## Store (`store.ts`)

`DataStore` speichert Sessions in einer `Map<sourceFile, SessionResult>` und
baut daraus bei Bedarf ein gecachtes `EventData`-Objekt.

| Methode | Beschreibung |
| --- | --- |
| `upsert(session)` | Session unter ihrem Dateipfad speichern, Cache verwerfen |
| `remove(sourceFile)` | Session entfernen; `true`, wenn vorhanden |
| `clear()` | alles löschen |
| `fileCount` | Anzahl gespeicherter Dateien (vor Duplikat-Bereinigung) |
| `getEventData()` | gecachtes `EventData` (Tage, Teilnehmer mit Teilern pro Tag) |

`build()` arbeitet in folgenden Schritten:

1. Duplikate nach `session.id` entfernen (kleinerer Dateipfad gewinnt).
2. Sessions nach `timestamp` aufsteigend sortieren.
3. Pro Session: Datum in die Tagesmenge aufnehmen; Teilnehmer nach `memberId`
   suchen oder anlegen; nicht-leere Namen/Verein späterer Sessions
   überschreiben frühere; jeden Teiler als `{ teiler, timestamp, sessionId }`
   unter `teilersByDay[date]` ablegen.
4. Tage sortieren und beschriften: `Tag <n> - DD.MM.YYYY`.
5. Teilnehmer in der Reihenfolge ihres ersten Auftretens zurückgeben.

## Berechnung der Ranglisten (`index.ts`)

`buildDayResponse(day, pick)` erzeugt die Antwort für einen Tag oder alle Tage.
`pick(participant)` liefert die zu wertenden `TeilerResult`-Einträge
(`teilersByDay[date]` bzw. alle Tage zusammen).

Pro Teilnehmer mit mindestens einem Wert:

| Feld | Berechnung |
| --- | --- |
| `bestTeiler` | kleinster Wert |
| `secondBestTeiler` | zweitkleinster Wert, sonst `null` |
| `teilerSum` | `round2(best + second)`, sonst `null` |
| `teilerCount` | Anzahl der Werte |
| `rank` | Position nach Sortierung `bestTeiler` aufsteigend (1-basiert, kein Gleichstand – stabile Sortierung) |

Teilnehmer ohne Wert im gewählten Zeitraum erscheinen nicht in der Liste.

`stats.bestTeiler / secondBestTeiler / thirdBestTeiler` sind die drei kleinsten
Werte **über alle Teilnehmer** inklusive Schützenname – ein Teilnehmer kann
mehrere Plätze belegen. `stats.participantCount` ist die Anzahl gelisteter
Teilnehmer.

## Skripte

| Befehl (in `server/`) | Wirkung |
| --- | --- |
| `npm run dev` | `tsx watch src/index.ts` – Neustart bei Codeänderung |
| `npm run build` | `tsc -p tsconfig.json` → `dist/` |
| `npm start` | `node dist/index.js` |

Vom Repo-Root: `npm run dev:server`, `npm run build:server`.

## Betriebshinweise

- Die API ist nur lesend (`GET`); es gibt keine Authentifizierung.
- Der Server liefert keine statischen Frontend-Dateien aus.
- Kein Graceful-Shutdown-Handler; der Prozess kann jederzeit beendet werden,
  da kein Zustand persistiert wird.
- `tsc` räumt `dist/` nicht auf. Nach dem Entfernen von Quelldateien
  `rm -rf server/dist && npm run build:server` ausführen.
- Health-Check: `GET /api/health` liefert `dataDir`, Anzahl geladener Dateien
  und Teilnehmer.
