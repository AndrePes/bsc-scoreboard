---
title: Architektur
---

# Architektur

## Überblick

BSC ScoreBoard folgt einer klassischen Trennung von Backend und Frontends. Der
Server ist die einzige Komponente mit Zugriff auf die Daten der Schießanlage;
beide Frontends kommunizieren ausschließlich über die REST-API.

```
+----------------------------------------+
|  Schießanlage (Artemis)                |
|  schreibt pro Durchgang                |
|  <Export>/YYYYMMDD/Exercise/raw/       |
|      *_ExerciseResultData.json         |
+-------------------+--------------------+
                    |  Dateisystem (lokal oder Netzlaufwerk)
                    v
+---------------------------------------------------------------+
|  server/  (Node.js, Express)                        Port 4000  |
|                                                               |
|  watcher.ts  --(add/change/unlink)-->  parser.ts              |
|  (chokidar)                             raw -> SessionResult   |
|                                             |                 |
|                                             v                 |
|                                        store.ts (DataStore)   |
|                                        In-Memory, Cache       |
|                                             |                 |
|  index.ts  <--- getEventData() -------------+                 |
|  REST-API  /api/event, /api/event/days/:date/participants ... |
+-----------------------------+---------------------------------+
                              |  HTTP/JSON (CORS: alle Origins)
          +-------------------+--------------------+
          v                                        v
+----------------------+                 +----------------------+
|  client/  Port 5173  |                 |  live_board/ 5174    |
|  React SPA           |                 |  React SPA           |
|  Tagesauswahl,       |                 |  Top-5-Kacheln,      |
|  Rangliste, Details, |                 |  Auto-Scroll-Tabelle,|
|  PDF-Export          |                 |  periodischer Reload |
+----------------------+                 +----------------------+
```

## Komponenten

### Server (`server/`)

Express-Anwendung in TypeScript (ESM). Beim Start werden die JSON-Dateien
**aller Tagesordner** (`<dataDir>/YYYYMMDD/Exercise/raw`) geladen;
anschließend überwacht ein chokidar-Watcher **nur den Ordner des heutigen
Tages** und übernimmt neue, geänderte und gelöschte Dateien sofort in den
In-Memory-Store. Fehlt der heutige Ordner noch, wartet der Server auf sein
Erscheinen; um Mitternacht wechselt er auf den nächsten Tagesordner. Es gibt **keine Datenbank** – der
Datenordner der Schießanlage ist die einzige Quelle der Wahrheit, der Store
kann jederzeit aus den Dateien neu aufgebaut werden.

Module (`server/src/`):

| Datei | Aufgabe |
| --- | --- |
| `index.ts` | Einstieg, Express-App, Routen, Berechnung der Ranglisten und Statistiken |
| `config.ts` | Lädt `config.json`, wertet Umgebungsvariablen aus, löst Pfade auf |
| `watcher.ts` | Initiales Laden aller Tagesordner, chokidar-Watcher für den heutigen Tagesordner (inkl. Warten auf dessen Anlegen und Tageswechsel), Retry beim Lesen, Logging |
| `parser.ts` | Validiert Rohdateien und bildet sie auf das interne Modell ab |
| `store.ts` | `DataStore`: Sessions pro Datei, Duplikat-Erkennung, Aufbau von `EventData` |
| `types.ts` | Rohformat (PascalCase) und internes Modell |

Details: [Server](server.md), [REST-API](api.md).

### Client (`client/`)

React-Single-Page-Application (Vite, Tailwind CSS 3) mit drei festen Spalten:
Sidebar mit Veranstaltungstagen, Mitte mit Statistik-Karten und Rangliste,
rechts Detailansicht des gewählten Teilnehmers. Rangliste als PDF exportierbar
(jsPDF). Lädt Daten bei Auswahlwechsel, kein automatisches Polling.

Details: [Client](client.md).

### Live-Board (`live_board/`)

React-SPA mit gleichem Stack wie der Client, aber ohne Interaktion: für
Monitore im Kiosk-Modus. Zeigt die fünf besten Teilnehmer als Kacheln und alle
weiteren in einer automatisch scrollenden Tabelle. Lädt Daten periodisch neu
und kann mehrere Veranstaltungstage clientseitig zusammenführen.

Details: [Live-Board](live-board.md).

## Datenfluss

1. Die Schießanlage schreibt nach einem Durchgang
   `YYYYMMDD-HHMMSS_<Stand>_<MemberId>_ExerciseResultData.json` in den
   Tagesordner `<dataDir>/<YYYYMMDD>/Exercise/raw/`.
2. chokidar (überwacht nur den heutigen Tagesordner) meldet `add` bzw.
   `change`. Der Watcher wartet über `awaitWriteFinish` (500 ms Stabilität),
   bis die Datei vollständig geschrieben ist, und liest sie mit bis zu drei
   Versuchen.
3. `parseExerciseResult()` prüft die Pflichtfelder, rechnet die Teiler von
   Metern in 1/100 mm um und erzeugt ein `SessionResult` (Teilnehmer, Datum,
   sortierte Teiler-Liste, Quelldatei).
4. `DataStore.upsert()` speichert die Session unter ihrem Dateipfad und
   invalidiert den Cache.
5. Beim nächsten API-Aufruf baut `DataStore.build()` das `EventData`-Objekt neu
   auf: Duplikate nach `Id` entfernen, nach Zeitstempel sortieren, Teilnehmer
   und Tage ableiten, Teiler nach Tag gruppieren.
6. `index.ts` berechnet aus `EventData` die angeforderte Sicht (ein Tag oder
   alle Tage): bester/zweitbester Teiler pro Teilnehmer, Summe, Anzahl,
   Rangfolge, Top-3 des Tages.
7. Client bzw. Live-Board rendern die Antwort. Das Live-Board sortiert
   zusätzlich nach `teilerSum`.

## Domänenregeln

Diese Regeln sind an mehreren Stellen im Code verankert und müssen bei
Änderungen konsistent bleiben:

- **Kleiner Teiler = besser.** Alle Ranglisten sind aufsteigend sortiert.
  `computeBestTeiler` liefert `Number.POSITIVE_INFINITY`, wenn keine Werte
  vorliegen.
- **Einheit 1/100 mm.** Rohwerte (`Teilers`) sind Meter. Umrechnung:
  `Math.round(m * 100000 * 10) / 10` (eine Nachkommastelle). Beispiel:
  `0.00034177 m` → `34.2`.
- **Jede Datei liefert nur ihre 3 besten Teiler.** `teilerCount` zählt daher
  Teiler-Werte, nicht Schüsse.
- **Tagesbestwert-Regel für die Gesamtansicht:** In der Tagesansicht sind
  „Bester“ und „2. Teiler“ die zwei besten Schüsse des Tages. In der
  Gesamtansicht zählt pro Tag nur der Tagesbestwert; hat ein Teilnehmer an
  mehreren Tagen geschossen, sind Bester und Zweiter die zwei kleinsten
  Tagesbestwerte (also aus verschiedenen Tagen) und die Summe deren Addition.
  Hat er nur an einem Tag geschossen, gelten die zwei besten Schüsse dieses
  Tages. Implementiert in `pickBestTwo()` (`server/src/index.ts`) und
  gleichlautend in `mergeRankings()` (`live_board/src/api.ts`). Jeder
  Listeneintrag trägt deshalb `bestTeilerDate` und `secondBestTeilerDate`.
- **Tage werden abgeleitet**, nicht konfiguriert: Datumsanteil von
  `LastShot.TimeStamp` (lokale Zeit der Anlage, Offset wird ignoriert). Label
  `Tag N - DD.MM.YYYY`, N = Position in der sortierten Tagesliste.
- **Duplikate:** Zwei Dateien mit gleicher `Id` gelten als derselbe Durchgang;
  es gewinnt die Datei mit dem lexikographisch kleineren Pfad.
- **Namensänderungen:** Bei mehreren Sessions eines Teilnehmers überschreiben
  spätere, nicht-leere Werte für Vor-/Nachname/Verein die früheren.
- **Sortierung Client vs. Live-Board:** Der Server (und damit der Client)
  sortiert nach `bestTeiler`; das Live-Board sortiert clientseitig nach
  `teilerSum` (Summe bester + zweitbester Teiler), Einträge ohne Summe ans
  Ende, bei Gleichstand nach `bestTeiler`.
- **Sentinel `'all'`:** Der Client verwendet den String `'all'` als
  `selectedDate` für die Gesamtansicht; der Server liefert dafür
  `day = { date: 'all', label: 'Alle Tage' }`.

## Laufzeit-Konfiguration statt Build-Konfiguration

Beide Frontends laden beim Start eine `config.json` aus ihrem Public-Ordner
(nach dem Build: `dist/config.json`). Server-Adresse, anzuzeigende Tage und
Scroll-Parameter lassen sich dadurch **ohne neuen Build** ändern – wichtig für
den Einsatz auf Wettkampf-Rechnern ohne Entwicklungsumgebung. Siehe
[Konfiguration](konfiguration.md).

## Typ-Duplikation

Die drei Pakete teilen keinen Code. Die API-Antwortformen sind daher dreifach
definiert:

- `server/src/index.ts` (nicht exportierte Interfaces `ParticipantStats`,
  `TopTeiler`) und `server/src/types.ts`
- `client/src/types.ts`
- `live_board/src/types.ts`

Eine Änderung an einer API-Antwort erfordert manuelle Anpassungen in allen
drei Paketen.

## Grenzen des Designs

- Kein persistenter Zustand außer den Quelldateien; Neustart = Neuaufbau.
- Keine Authentifizierung; die API ist für ein lokales Netz gedacht.
- Der Server liefert **keine** statischen Frontend-Dateien aus; Client und
  Live-Board benötigen einen eigenen Webserver oder den Vite-Dev-Server
  (siehe [Betrieb](betrieb.md)).
- Der Watcher überwacht nur den heutigen Tagesordner (lokale Zeit des
  Server-Rechners). Nachträglich in ältere Tagesordner geschriebene Dateien
  werden erst beim nächsten Serverstart gelesen.
