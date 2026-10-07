# BSC ScoreBoard

Single-Page-Application zur Anzeige von Schießwettkampf-Ergebnissen.

## Struktur

```
.
├── client/       # BSC ScoreBoard (React + Vite + TypeScript + Tailwind)
├── live_board/   # Live-Board für große Monitore (gleicher Stack wie client)
└── server/       # BSC ScoreBoard Server (Express + TypeScript) – REST API
```

Der Server überwacht den Export-Ordner der Schießanlage, in den diese nach
jedem Durchgang eine `*_ExerciseResultData.json` schreibt (Format siehe
`schema.json`; Ablage pro Tag unter `<Export>/YYYYMMDD/Exercise/raw/`), liest
daraus die Teilnehmer und ihre besten Teiler und stellt die Auswertung als
JSON unter `/api` bereit. Das Frontend konsumiert diese API und rendert das
3-Spalten-Layout.

Ausführliche Dokumentation: Ordner [`docs/`](docs/index.md) (GitHub Pages).

## Voraussetzungen

- Node.js 20.19+
- npm 9+

## Installation

```bash
# im Repo-Root: installiert Server- und Client-Abhängigkeiten
npm run install:all
```

## Entwicklung starten

In zwei separaten Terminals:

```bash
# Terminal 1 – Backend (Port 4000)
npm run dev:server

# Terminal 2 – Frontend (Port 5173, proxied /api → :4000)
npm run dev:client

# optional: Live-Board (Port 5174, proxied /api → :4000)
npm run dev:live
```

Anschließend `http://localhost:5173` (Client) bzw. `http://localhost:5174`
(Live-Board) im Browser öffnen.

## Production-Build

```bash
npm run build:server
npm run build:client
npm run build:live
```

## Konfiguration: Server (Quell-Ordner der Daten)

Der Server liest beim Start `server/config.json`:

```json
{
  "dataDir": "./data/raw",
  "daySubDir": "Exercise/raw",
  "usePolling": false,
  "pollingIntervalMs": 1000,
  "eventName": "BSC ScoreBoard",
  "rangeName": "Schießanlage BSC"
}
```

| Schlüssel | Bedeutung |
| --- | --- |
| `dataDir` | **Wurzel** des Export-Ordners der Schießanlage, z. B. `C:/temp/RangePrinterExport`. Relative Pfade beziehen sich auf `server/`. |
| `daySubDir` | Unterpfad innerhalb eines Tagesordners (Standard `Exercise/raw`). |
| `usePolling` | `true`, wenn der Ordner auf einem Netzlaufwerk (SMB/NFS) liegt, auf dem keine Dateisystem-Events ankommen. |
| `pollingIntervalMs` | Abfrageintervall bei `usePolling`. |
| `eventName`, `rangeName` | Anzeigenamen im Client. |

Umgebungsvariablen überschreiben die Datei: `DATA_DIR` (Export-Wurzel),
`CONFIG_PATH` (alternative config.json), `PORT` (HTTP-Port, Standard `4000`).

**Ordnerstruktur:** Die Anlage legt pro Tag einen Ordner `YYYYMMDD` an
(z. B. `20260929`), darunter `Exercise/raw/` mit den JSON-Dateien. Der Server
vervollständigt den Pfad selbst: `<dataDir>/<YYYYMMDD>/<daySubDir>`.

**File-Monitor:** Beim Start werden die `*.json`-Dateien **aller**
Tagesordner geladen. Überwacht wird **nur der Ordner des heutigen Tages**
(lokale Zeit des Server-Rechners): neu erstellte, geänderte und gelöschte
Dateien werden automatisch übernommen; die API liefert sofort die aktuellen
Daten. Existiert der heutige Ordner noch nicht, wartet der Server darauf
(Prüfung alle 5 s); um Mitternacht wechselt er auf den neuen Tagesordner.
Dateien ohne die benötigten Felder werden mit einer Warnung im Log übersprungen.

Aus jeder Datei werden verwendet:

| JSON-Pfad | Bedeutung |
| --- | --- |
| `UserSessionInformation.UserData.MemberId` | Teilnehmer-Nummer (ID) |
| `UserSessionInformation.UserData.FirstName` | Vorname |
| `UserSessionInformation.UserData.Name` | Nachname |
| `ParameterResults[].Teilers` | die 3 besten Teiler (Meter, werden in 1/100 mm umgerechnet) |
| `LastShot.TimeStamp` | Zeitstempel; das Datum bestimmt den Veranstaltungstag |
| `Id` | Durchgangs-ID zur Duplikat-Erkennung |

Die Veranstaltungstage ergeben sich aus den vorkommenden Daten der Zeitstempel.

## Konfiguration: Server-Adresse des Clients

Der Client liest beim Start die Datei `client/public/config.json`
(nach dem Build: `client/dist/config.json`). Sie wird zur Laufzeit geladen,
d. h. Änderungen erfordern **keinen** neuen Build.

```json
{
  "apiBaseUrl": ""
}
```

| Wert | Bedeutung |
| --- | --- |
| `""` (leer) | API auf demselben Host wie der Client (Dev: Vite-Proxy `/api` → `:4000`) |
| `"http://192.168.1.50:4000"` | Server-App läuft auf einem separaten Rechner |

Der Server erlaubt CORS für alle Origins, sodass ein getrennter Betrieb ohne
weitere Anpassungen funktioniert. Der Server-Port wird über die Umgebungsvariable
`PORT` gesetzt (Standard `4000`).

## Live-Board (`live_board/`)

Vollbild-Ansicht für Monitore über der Schießbahn. Oberes Drittel: fünf Kacheln
mit den fünf besten Gesamt-Teilern der Veranstaltung. Unterer Bereich: Tabelle
aller weiteren Teilnehmer ab Rang 6 mit denselben Werten wie im Client (bester
Teiler, 2. Teiler, Summe, Anzahl). **Sortierung (Client und Live-Board): Summe
aus bestem und zweitbestem Teiler, aufsteigend** (kleiner = besser);
Teilnehmer mit nur einem Teiler stehen am Ende, bei Gleichstand entscheidet
der bessere Einzel-Teiler. Die Tabelle zeigt eine feste Zeilenanzahl,
scrollt langsam nach unten und springt am Ende wieder an den Anfang. Die Daten
werden periodisch neu geladen; die Uhrzeit der letzten Aktualisierung steht
oben rechts.

Konfiguration: `live_board/public/config.json` (nach dem Build:
`live_board/dist/config.json`, zur Laufzeit geladen, kein Rebuild nötig):

```json
{
  "apiBaseUrl": "",
  "dates": [],
  "refreshIntervalSec": 60,
  "scrollSpeedPxPerSec": 24,
  "scrollPauseSec": 3,
  "visibleRows": 6
}
```

| Schlüssel | Bedeutung |
| --- | --- |
| `apiBaseUrl` | Adresse der Server-App, z. B. `"http://192.168.1.50:4000"`. Leer = gleicher Host. |
| `dates` | Anzuzeigende Tage als `["YYYY-MM-DD", ...]`. `[]` = alle Tage. Bei mehreren Tagen wird die Rangliste im Live-Board zusammengeführt. |
| `refreshIntervalSec` | Aktualisierungsintervall der Daten in Sekunden. |
| `scrollSpeedPxPerSec` | Scrollgeschwindigkeit der Tabelle in Pixel pro Sekunde. |
| `scrollPauseSec` | Pause am Tabellenanfang und -ende in Sekunden. |
| `visibleRows` | Anzahl gleichzeitig sichtbarer Tabellenzeilen. |

Für den Monitor den Browser im Vollbild-/Kiosk-Modus starten, z. B.
`chrome --kiosk http://<host>/`.

## REST API

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| `GET` | `/api/event` | Veranstaltungs-Metadaten + alle Tage |
| `GET` | `/api/event/days/:date/participants` | Tagesstatistik + sortierte Teilnehmerliste |
| `GET` | `/api/event/all/participants` | Statistik + Teilnehmerliste über alle Tage |
| `GET` | `/api/participants/:id?date=YYYY-MM-DD` | Detailstatistik eines Teilnehmers |
| `GET` | `/api/health` | Health-Check (inkl. `dataDir`, `todayDir`, `watchDir`, Anzahl geladener Dateien/Teilnehmer) |

Die Teilnehmerlisten enthalten pro Teilnehmer `bestTeiler`, `secondBestTeiler`
(jeweils mit `…Date`), `teilerSum` (Summe aus bestem und zweitbestem Teiler)
und `teilerCount` (Anzahl gewerteter Teiler-Werte). In der Gesamtansicht
(`/all/`) gilt die **Zeitraum-Regel**: Bester und Zweiter sind die zwei
kleinsten Teiler über alle Tage (auch beide vom selben Tag möglich). Die Top-3-Werte in `stats` (`bestTeiler`, `secondBestTeiler`,
`thirdBestTeiler`) sind Objekte mit `teiler`, `participantId`, `firstName`,
`lastName`. `/api/participants/:id` liefert zusätzlich `allDaysStats` nach
derselben Regel sowie `days[]` mit den Bestwerten pro Tag.

## UI-Aufbau

1. **Brand Sidebar (Emerald 600)** – Logo, Titel, Liste der Veranstaltungstage.
2. **Center** – Statistik-Cards (Top-3-Teiler inkl. Name des Schützen) + nach Summe sortierte Rangliste
   der Teilnehmer (bester Teiler, zweitbester Teiler, Summe). Über der Rangliste kann
   diese als PDF exportiert werden.
3. **Details** – Description-List mit Werten des ausgewählten Teilnehmers (Tag & Gesamt,
   inkl. Datum von bestem und zweitbestem Teiler) sowie Bestwerte pro Tag.
