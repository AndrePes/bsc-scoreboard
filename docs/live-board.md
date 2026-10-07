---
title: Live-Board
---

# Live-Board (`live_board/`)

Das Live-Board (`bsc-scoreboard-live-board`) ist eine interaktionsfreie
Vollbild-Ansicht für Monitore über der Schießbahn. Es zeigt die fünf besten
Teilnehmer als Kacheln und alle weiteren in einer automatisch scrollenden
Tabelle, lädt die Daten periodisch neu und kann mehrere Veranstaltungstage
zusammenführen. Gleicher Stack wie der Client (React 18, Vite 5, Tailwind 3),
ohne PDF-Bibliotheken.

- Dev-Server: **Port 5174**, Proxy `/api` → `http://localhost:4000`
- Konfiguration: `live_board/public/config.json` (siehe [Konfiguration](konfiguration.md))

## Aufbau

```
live_board/
├── index.html                    # Titel "BSC ScoreBoard – Live-Board"
├── public/
│   ├── config.json               # apiBaseUrl, dates, refreshIntervalSec, ...
│   └── favicon.svg
├── vite.config.ts                # Port 5174, Proxy /api
└── src/
    ├── main.tsx
    ├── App.tsx                   # Konfiguration laden, Refresh-Timer, Layout
    ├── api.ts                    # loadLiveBoardData, mergeRankings, rankBySum
    ├── config.ts                 # lädt und validiert /config.json
    ├── format.ts                 # formatTeiler, formatTime
    ├── types.ts                  # API-Formen + LiveBoardData
    └── components/
        ├── Header.tsx            # Logo, Event, Zeitraum, letzte Aktualisierung
        ├── TopFive.tsx           # fünf Kacheln (Rang 1–5)
        └── AutoScrollTable.tsx   # scrollende Tabelle (Rang >= 6)
```

## Oberfläche

```
+------------------------------------------------------------------------+
| (Logo) BSC ScoreBoard                       Letzte Aktualisierung      |
|        Schießanlage BSC · Tag 1 - 04.09.2026            18:52:07       |
+------------------------------------------------------------------------+
| [Beste Summe] [Rang 2]     [Rang 3]     [Rang 4]     [Rang 5]          |
|  Bernd Meyer   ...          ...          ...          ...              |
|  Summe 30.3    Bester 12.3 / 2. Teiler 18.0                             |
+------------------------------------------------------------------------+
| Rang | Name / Verein      | Bester Teiler | 2. Teiler | Summe | Anzahl |
|  6   | ...                |     ...       |    ...    |  ...  |  ...   |
|  7   | ...                |               |           |       |        |   ^ scrollt
|  ... | (visibleRows Zeilen sichtbar)                                   |   | langsam
+------------------------------------------------------------------------+
```

Das Raster teilt die Fläche unter dem Header im Verhältnis **1 : 2**
(`grid-rows-[1fr_2fr]`): oben die Kacheln, unten die Tabelle.

### Header

- Zielscheiben-Logo, `eventName` (groß), darunter `rangeName · <Zeitraum>`.
- Rechts **Letzte Aktualisierung** mit Uhrzeit `HH:MM:SS` des letzten
  erfolgreichen Ladevorgangs (keine laufende Uhr).
- Bei Ladefehler ersetzt ein rotes Badge `Verbindungsfehler: <Fehler>` die
  Uhrzeit; die zuletzt geladenen Daten bleiben sichtbar.

### Top-5-Kacheln (`TopFive.tsx`)

Immer fünf Kacheln, zugeordnet über das Feld `rank` (1–5). Jede Kachel zeigt:

- Rangkreis und Tag `Beste Summe` (Rang 1, grün hervorgehoben) bzw. `Rang n`
- Name, darunter Verein oder `<n> Teiler`
- groß: **Summe** (`teilerSum`)
- rechts: `Bester Teiler` und `2. Teiler`

Fehlende Ränge (weniger als 5 Teilnehmer) erscheinen als Platzhalter mit `–`.

### Auto-Scroll-Tabelle (`AutoScrollTable.tsx`)

Spalten: `Rang | Name / Verein | Bester Teiler | 2. Teiler | Summe | Anzahl`.
Enthält alle Teilnehmer ab Rang 6; bei ≤ 5 Teilnehmern steht dort
`Keine weiteren Teilnehmer`.

Scroll-Mechanik:

1. **Zeilenhöhe** = `floor(Viewport-Höhe / visibleRows)`; wird per
   `ResizeObserver` bei Größenänderung neu berechnet. Damit sind immer genau
   `visibleRows` Zeilen sichtbar.
2. Bewegung per `requestAnimationFrame` und `transform: translateY(-offset)`
   (keine CSS-Transition, kein natives Scrollen).
3. Phasen: `pauseTop` (Pause `scrollPauseSec`) → `scrolling` (Geschwindigkeit
   `scrollSpeedPxPerSec`) → `pauseBottom` (Pause) → **Sprung** zurück an den
   Anfang → `pauseTop` …
4. Passen alle Zeilen in den Viewport, wird nicht gescrollt.
5. Ein Daten-Refresh mit gleicher Zeilenanzahl setzt die Scroll-Position
   nicht zurück; ändert sich die Anzahl, beginnt der Zyklus von oben.

## Verhalten

### Startablauf (`App.tsx`)

1. `loadConfig()` lädt `config.json`; bis dahin steht `Lade Konfiguration…`.
2. `loadLiveBoardData(config)` wird sofort und danach alle
   `refreshIntervalSec` Sekunden per `setInterval` aufgerufen.
3. Erfolg: neue Daten anzeigen, Fehler löschen. Fehler: Fehlertext im Header,
   alte Daten bleiben stehen.
4. Vor dem ersten erfolgreichen Laden zeigt der Kachelbereich `Lade Daten…`.

### Datenbeschaffung (`api.ts`)

`loadLiveBoardData(config)` ruft zuerst immer `GET /api/event` (Namen) und
dann – abhängig von `config.dates` – die Rangliste ab:

| `dates` | Anfrage(n) | Zeitraum-Label |
| --- | --- | --- |
| `[]` | `GET /api/event/all/participants` | `Alle Tage` |
| ein Datum | `GET /api/event/days/<date>/participants` | z. B. `Tag 1 - 04.09.2026` |
| mehrere Daten | parallel ein Aufruf pro Datum, dann `mergeRankings()` | Labels mit ` · ` verbunden |

Bei mehreren Tagen wird ein fehlschlagender Tag einzeln protokolliert
(`Tag <date> konnte nicht geladen werden: …`) und übersprungen; die übrigen
Tage werden trotzdem angezeigt. Schlagen `/api/event` oder die einzelne
Ranglisten-Anfrage fehl, erscheint der `Verbindungsfehler`.

Alle Anfragen verwenden `cache: 'no-store'`.

### Sortierung nach Summe (`rankBySum`)

Das Live-Board sortiert nach `teilerSum` (bester + zweitbester Teiler),
aufsteigend – dieselbe Regel wie der Server (`compareBySum`), clientseitig
wiederholt, weil beim Zusammenführen mehrerer Tage neu sortiert werden muss:

1. Einträge ohne Summe (nur ein Teiler) stehen am Ende, untereinander nach
   `bestTeiler`.
2. Bei gleicher Summe entscheidet `bestTeiler`.
3. `rank` wird anschließend clientseitig neu von 1 an vergeben (bei einem
   Tag oder „alle Tage“ identisch mit dem Serverwert).

### Zusammenführen mehrerer Tage (`mergeRankings`)

Für jeden Teilnehmer werden die Tages-Einträge gesammelt, `teilerCount`
aufsummiert und Name/Verein des späteren Tages übernommen. Bester und
zweitbester Teiler folgen der **Zeitraum-Regel** – identisch zur
Server-Gesamtansicht (`/api/event/all/participants`), damit Client und
Live-Board dieselben Werte zeigen:

Bester und 2. Teiler sind die zwei kleinsten Teiler über alle geladenen Tage,
unabhängig vom Tag (auch beide vom selben Tag). Beispiel: Tag 1: 10.0 / 23.5,
Tag 2: 25.5 / 19.8 → 10.0 und 19.8, Summe 29.8.

`bestTeilerDate` / `secondBestTeilerDate` werden entsprechend übernommen,
`teilerSum` ist die Summe beider Werte; danach `rankBySum`.

Als Kandidaten genügen pro Tag `bestTeiler` und `secondBestTeiler`, da die zwei
global kleinsten Werte immer darunter liegen; beides liefert jeder
Listeneintrag der API.

### Konfigurationsvalidierung (`config.ts`)

| Schlüssel | Regel | Standard |
| --- | --- | --- |
| `apiBaseUrl` | String, getrimmt, ohne abschließende `/` | `""` |
| `dates` | Array (oder einzelner String) von `YYYY-MM-DD`; ungültige Einträge werden verworfen | `[]` |
| `refreshIntervalSec` | Zahl > 0 | `60` |
| `scrollSpeedPxPerSec` | Zahl > 0 | `24` |
| `scrollPauseSec` | Zahl ≥ 0 | `3` |
| `visibleRows` | ganze Zahl ≥ 1 (gerundet) | `6` |

Jeder Schlüssel fällt einzeln auf den Standard zurück; eine fehlende
`config.json` führt zu den Standardwerten.

## Betrieb auf dem Monitor

Das Live-Board bietet keine eigene Vollbild-Funktion – der Browser wird im
Kiosk-Modus gestartet, z. B.

```bash
chrome --kiosk http://<host>/
```

Weitere Hinweise: [Ausführen und Betrieb](betrieb.md#live-board-im-kiosk-modus).

## Skripte

| Befehl (in `live_board/`) | Wirkung |
| --- | --- |
| `npm run dev` | Vite-Dev-Server auf Port 5174 |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | statische Vorschau des Builds |

Vom Repo-Root: `npm run dev:live`, `npm run build:live`.
