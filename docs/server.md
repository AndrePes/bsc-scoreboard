---
title: Server
---

# Server (`server/`)

Der Server (`bsc-scoreboard-server`) ist eine Express-Anwendung in TypeScript,
die den Export-Ordner der Schießanlage (ein Unterordner pro Tag,
`<dataDir>/YYYYMMDD/Exercise/raw`) einliest, den Ordner des heutigen Tages
überwacht und die Auswertung als JSON unter `/api` bereitstellt. Er hält alle
Daten im Speicher; es gibt keine Datenbank.

- Standard-Port: **4000** (Umgebungsvariable `PORT`)
- Konfiguration: `server/config.json` (siehe [Konfiguration](konfiguration.md))
- API-Referenz: [REST-API](api.md)

## Aufbau

```
server/
├── config.json          # Laufzeit-Konfiguration (Export-Wurzel, daySubDir, Namen)
├── package.json         # ESM ("type": "module"), Skripte dev/build/start
├── tsconfig.json        # ES2022, strict, outDir dist
├── data/
│   ├── raw/                          # Beispiel-Exportordner (Standard-dataDir)
│   │   └── 20260904/Exercise/raw/    # 67 Beispieldateien eines Tages
│   └── *.json                        # ISSF-Format-Beispiele (nicht im Tagesordner, werden ignoriert)
├── dist/                # Build-Ausgabe (tsc), nicht versioniert
└── src/
    ├── index.ts         # Einstieg: Express, Routen, Ranglisten-Berechnung
    ├── config.ts        # loadConfig(), SERVER_ROOT, Pfadauflösung
    ├── watcher.ts       # startFileMonitor(): alle Tage laden, heutigen Tagesordner überwachen
    ├── parser.ts        # parseExerciseResult(): Rohdatei -> SessionResult
    ├── store.ts         # DataStore: In-Memory-Speicher mit Cache
    └── types.ts         # Rohformat + internes Modell
```

## Startablauf (`index.ts`)

1. `loadConfig()` liest `config.json` und Umgebungsvariablen.
2. `new DataStore(eventName, rangeName)` legt den leeren Store an.
3. Express-App mit `cors()` (alle Origins) und `express.json()`.
4. `await startFileMonitor(config, store)` – erst wenn alle vorhandenen
   Dateien aller Tagesordner geladen sind (und der Watcher für den heutigen
   Ordner bereit ist, sofern dieser existiert), geht es weiter.
5. `app.listen(PORT)` – Log: `BSC ScoreBoard Server listening on http://localhost:4000`.

Schlägt der Start fehl (z. B. Export-Wurzel nicht anlegbar oder lesbar), wird
`Server konnte nicht gestartet werden: …` protokolliert und der Prozess mit
Exit-Code 1 beendet.

## Konfiguration (`config.ts`)

`SERVER_ROOT` ist das Verzeichnis oberhalb des laufenden Moduls – sowohl bei
`tsx src/index.ts` als auch bei `node dist/index.js` also `server/`. Alle
relativen Pfade (`dataDir`, `CONFIG_PATH`) werden gegen `SERVER_ROOT`
aufgelöst, **nicht** gegen das aktuelle Arbeitsverzeichnis.

| Schlüssel | Standard | Prüfung |
| --- | --- | --- |
| `dataDir` | `server/data/raw` | nicht-leerer String; Wurzel des Export-Ordners der Anlage |
| `daySubDir` | `Exercise/raw` | nicht-leerer String; Unterpfad im Tagesordner (Backslashes erlaubt) |
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

### Ordnerstruktur

Die Schießanlage legt unter dem Export-Ordner **pro Tag einen Ordner** mit dem
Datum als Namen (`YYYYMMDD`) an; die Ergebnisdateien liegen darin unter
`Exercise/raw/`:

```
<dataDir>/                      z. B. C:\temp\RangePrinterExport
├── 20260928/
│   └── Exercise/
│       └── raw/
│           ├── 20260928-101512_3_170060_ExerciseResultData.json
│           └── …
└── 20260929/                   heutiger Tag – wird überwacht
    └── Exercise/
        └── raw/
            └── …
```

In `config.json` wird nur die Wurzel (`dataDir`) angegeben; der Server
vervollständigt den Pfad selbst:

```
<dataDir>/<YYYYMMDD>/<daySubDir>      daySubDir = "Exercise/raw" (Standard)
```

Der heutige Tag wird in **lokaler Zeit des Server-Rechners** bestimmt
(`todayDirName()`).

### Ablauf

`startFileMonitor(config, store)`:

1. Legt `dataDir` (die Wurzel) an, falls nicht vorhanden (`mkdir -p`).
   Tagesordner werden **nicht** angelegt – das macht die Anlage.
2. **Initial-Load aller Tage:** liest alle Unterordner mit achtstelligem
   Namen (`^\d{8}$`), sucht darin `<daySubDir>` und lädt alle `.json`-Dateien
   (sortiert). Log pro Tag `[monitor] Tag 20260904: 67 von 67 Datei(en) geladen`
   und gesamt `[monitor] Initial <ok> von <n> Datei(en) aus <k> Tagesordner(n)
   unter <dataDir> geladen`. Tagesordner ohne `<daySubDir>` werden mit
   Warnung übersprungen.
3. **Watcher nur für heute:** existiert `<dataDir>/<heute>/<daySubDir>`, wird
   chokidar dafür gestartet (Optionen siehe unten). Existiert er noch nicht
   (die Anlage erzeugt ihn beim ersten Durchgang), meldet der Server einmalig
   `[monitor] Tagesordner … existiert noch nicht, warte auf die Schießanlage …`
   und prüft alle **5 s** erneut. Sobald der Ordner erscheint, startet der
   Watcher und übernimmt bereits darin liegende Dateien über die
   `add`-Events (kein Race zwischen Verzeichnislesen und Watcher-Start).
4. **Tageswechsel:** Die 5-Sekunden-Prüfung erkennt ein neues Datum, schließt
   den alten Watcher (`[monitor] Tageswechsel 20260928 -> 20260929`) und
   verfährt für den neuen Ordner wie in Schritt 3. Die Daten der Vortage
   bleiben im Store.

chokidar-Optionen für den Tagesordner:

| Option | Wert | Bedeutung |
| --- | --- | --- |
| `ignoreInitial` | `true` beim Start (Dateien bereits geladen), `false` bei später erscheinendem Ordner / Tageswechsel | vorhandene Dateien mitnehmen |
| `depth` | `0` | nur der Tagesordner selbst, keine Unterordner |
| `usePolling` | aus Config | Polling für Netzlaufwerke |
| `interval` | `pollingIntervalMs` | Abfrageintervall beim Polling |
| `awaitWriteFinish` | `{ stabilityThreshold: 500, pollInterval: 100 }` | wartet, bis die Datei 500 ms unverändert ist |
| `ignored` | Funktion | ignoriert Dateien ohne `.json`-Endung |

Ereignisse:

| Ereignis | Aktion | Log |
| --- | --- | --- |
| `add` | Datei lesen, parsen, `store.upsert()` | `[monitor] Neu: <datei> -> <Vorname> <Name> (<MemberId>), <Datum>, Teiler a / b / c` |
| `change` | wie `add` | `[monitor] Geändert: …` |
| `unlink` | `store.remove()` | `[monitor] Entfernt: <datei>` |
| `error` | – | `[monitor] Fehler: …` |

Nach `ready`: `[monitor] Überwache <dataDir>/<heute>/<daySubDir> (Dateisystem-Events)`
bzw. `(Polling, <ms> ms)`.

`startFileMonitor` liefert ein `FileMonitor`-Objekt mit `watchDir` (aktuell
überwachter Ordner oder `null`), `todayDir` und `close()`; `/api/health` gibt
beide Pfade aus.

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
- Health-Check: `GET /api/health` liefert `dataDir`, `todayDir`, `watchDir`
  (`null`, solange der heutige Tagesordner fehlt), Anzahl geladener Dateien
  und Teilnehmer.
- Dateien, die in **ältere** Tagesordner geschrieben werden, werden erst beim
  nächsten Serverstart gelesen – überwacht wird nur der heutige Ordner.
- Uhrzeit und Datum des Server-Rechners müssen mit der Anlage übereinstimmen,
  sonst wird der falsche Tagesordner überwacht.
