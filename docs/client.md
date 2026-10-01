---
title: Client
---

# Client (`client/`)

Der Client (`bsc-scoreboard-client`) ist die Bedienoberfläche für die
Wettkampfleitung: Auswahl des Veranstaltungstags, Statistik-Karten,
Rangliste, Teilnehmerdetails und PDF-Export. React 18 + Vite 5 + Tailwind CSS 3.

- Dev-Server: **Port 5173**, Proxy `/api` → `http://localhost:4000`
- Konfiguration: `client/public/config.json` (siehe [Konfiguration](konfiguration.md))

## Aufbau

```
client/
├── index.html                 # lang="de", Titel "BSC ScoreBoard", Favicon
├── public/
│   ├── config.json            # { "apiBaseUrl": "" } – zur Laufzeit geladen
│   └── favicon.svg            # Zielscheiben-Logo (emerald)
├── vite.config.ts             # Port 5173, Proxy /api
├── tailwind.config.js, postcss.config.js
├── tsconfig.json              # strict, noUnusedLocals, noUnusedParameters
└── src/
    ├── main.tsx               # React-Bootstrap (StrictMode)
    ├── App.tsx                # Zustand, 3-Spalten-Layout
    ├── api.ts                 # API-Client (fetch)
    ├── config.ts              # lädt /config.json, normalisiert apiBaseUrl
    ├── pdfExport.ts           # Rangliste als PDF (jsPDF), lazy geladen
    ├── types.ts               # API-Antwortformen
    ├── index.css              # Tailwind-Direktiven, Grundlayout
    └── components/
        ├── Sidebar.tsx        # Logo, Veranstaltungsname, Tagesliste
        ├── CenterColumn.tsx   # Statistik-Karten, Rangliste, PDF-Button
        ├── DetailsColumn.tsx  # Teilnehmerdetails (Description-List)
        └── StatCard.tsx       # Karte für einen Top-Teiler
```

## Oberfläche

Das Layout besteht aus drei festen Spalten (`grid-cols-[280px_1fr_320–420px]`);
es gibt keine responsiven Breakpoints – die Anwendung ist für
Desktop-Bildschirme ausgelegt.

```
+-----------+----------------------------------------+---------------------+
| Sidebar   | Tag 1 - 04.09.2026                     | Teilnehmerdetails   |
| (emerald) | Tagesstatistik und Rangliste           |                     |
|           | [Bester] [Zweitbester] [Drittbester]   | Vorname, Nachname   |
| Logo      |                                        | ID                  |
| Eventname | Rangliste        [Als PDF exportieren] | Bester Teiler (Tag) |
| Anlage    | #  Name / Verein  Bester 2.Teiler Summe| Anzahl (Tag)        |
|           | 1  Bernd Meyer     12.3   18.0   30.3  | Bester Teiler (Alle)|
| Gesamt    | 2  ...                                 | Anzahl (Alle)       |
| Tag 1     |                                        |                     |
| Tag 2     |                                        |                     |
+-----------+----------------------------------------+---------------------+
```

### Sidebar (links, Emerald 600)

- Zielscheiben-Logo, `eventName` und `rangeName` aus `/api/event`.
- Abschnitt **Veranstaltungstage**: Button **Gesamt (alle Tage)** und ein
  Button pro Tag (Label `Tag N - DD.MM.YYYY`). Der aktive Eintrag ist weiß
  hinterlegt.
- Fußzeile `v1.0 · BSC ScoreBoard`.

### Mitte

- Überschrift = Label des gewählten Tages (`Alle Tage` bei Gesamtansicht).
- Drei **Statistik-Karten**: Bester, Zweitbester und Drittbester Teiler des
  Zeitraums (in der Gesamtansicht über alle Tage), jeweils mit Name des
  Schützen. Die erste Karte ist hervorgehoben.
- **Rangliste** als Tabelle mit Spalten `#`, `Name / Verein`, `Bester`,
  `2. Teiler`, `Summe`. Unter dem Namen stehen Verein (oder `–`) und
  `<n> Teiler`. Die Reihenfolge entspricht der Server-Sortierung nach
  `bestTeiler`. In der Gesamtansicht gilt die Tagesbestwert-Regel: `Bester`
  und `2. Teiler` sind bei mehreren Tagen die zwei besten Tagesbestwerte
  aus verschiedenen Tagen, `Summe` deren Addition. Ein Klick auf eine Zeile
  wählt den Teilnehmer aus (grün hervorgehoben).
- Button **Als PDF exportieren** (siehe unten); deaktiviert, wenn keine Daten
  vorliegen, geladen wird oder ein Export läuft.

### Details (rechts)

Beschreibungsliste des gewählten Teilnehmers:

| Zeile | Quelle | Hinweis |
| --- | --- | --- |
| Vorname, Nachname | `firstName`, `lastName` | |
| ID | `id` (MemberId) | |
| Bester Schuss/Teiler (Ausgewählter Tag) | `selectedDayStats.bestTeiler` | nur in der Tagesansicht |
| Anzahl gewerteter Teiler (Ausgewählter Tag) | `selectedDayStats.teilerCount` | nur in der Tagesansicht |
| Bester Teiler (Alle Tage) | `allDaysStats.bestTeiler` + `bestTeilerDate` | z. B. `29.9 · 12.09.2026` |
| 2. Teiler (Alle Tage) | `allDaysStats.secondBestTeiler` + `secondBestTeilerDate` | z. B. `43.9 · 14.09.2026` |
| Summe (Alle Tage) | `allDaysStats.teilerSum` | |
| Anzahl gewerteter Teiler (Alle Tage) | `allDaysStats.teilerCount` | |

Darunter folgt der Abschnitt **Bestwerte pro Tag**: eine Zeile pro Tag mit
Werten (`days[]`), Format `<Bestwert> · <n> Teiler`. Die Tage, aus denen
bester und zweitbester Teiler der Gesamtwertung stammen, sind grün
hervorgehoben (bei nur einem Tag ist das ein einzelner Tag).

Die Gesamtwertung folgt der Tagesbestwert-Regel (siehe
[Architektur](architektur.md#domänenregeln)): bei mehreren Tagen zählt pro
Tag nur der beste Schuss, Bester und Zweiter stammen aus verschiedenen Tagen.

Der Untertitel lautet `Angaben für <Tag> und alle Tage` bzw.
`Angaben für alle Tage` in der Gesamtansicht.

## Verhalten

### Laden und Auswahl

1. Beim Start lädt `App` einmalig `GET /api/event`. Der **erste Tag** wird
   automatisch ausgewählt.
2. Bei Tageswechsel lädt `CenterColumn`
   `GET /api/event/days/<date>/participants` bzw. bei **Gesamt**
   `GET /api/event/all/participants`. Die Teilnehmerauswahl wird
   zurückgesetzt.
3. Bei Teilnehmerauswahl lädt `DetailsColumn`
   `GET /api/participants/<id>?date=<date>`; in der Gesamtansicht ohne
   `date`.

Der Client **pollt nicht** – neue Dateien der Anlage erscheinen erst nach
erneutem Tages-Klick oder Neuladen der Seite. Für eine automatisch
aktualisierende Anzeige ist das [Live-Board](live-board.md) vorgesehen.

Der Sentinel-Wert `'all'` in `selectedDate` steht für die Gesamtansicht
(`client/src/App.tsx`).

### Status- und Fehlermeldungen

| Situation | Meldung |
| --- | --- |
| `/api/event` wird geladen | `Lade Veranstaltung…` |
| `/api/event` fehlgeschlagen | `Fehler beim Laden der Veranstaltung: <Fehler>` |
| kein Tag gewählt | `Bitte einen Tag in der Sidebar auswählen.` |
| Rangliste wird geladen | `Lade Teilnehmer…` |
| Rangliste leer | `Keine Teilnehmer an diesem Tag.` |
| Rangliste fehlgeschlagen | `Fehler: <Fehler>` |
| kein Teilnehmer gewählt | `Bitte einen Teilnehmer aus der Rangliste auswählen, um Details anzuzeigen.` |
| Details werden geladen | `Lade Details…` |
| PDF-Export läuft | `Exportiere…` |

Fehlende Werte werden als `–` dargestellt.

### API-Zugriff (`api.ts`, `config.ts`)

`loadConfig()` lädt beim ersten Aufruf `<BASE_URL>config.json` mit
`cache: 'no-store'` und merkt sich das Ergebnis. `apiBaseUrl` wird getrimmt
und von abschließenden Schrägstrichen befreit; bei Fehlern gilt `""`
(gleicher Host). Jede Anfrage geht an `${apiBaseUrl}/api/...`.

| Funktion | Endpunkt |
| --- | --- |
| `api.getEvent()` | `GET /api/event` |
| `api.getDayParticipants(date)` | `GET /api/event/days/:date/participants` |
| `api.getAllDaysParticipants()` | `GET /api/event/all/participants` |
| `api.getParticipant(id, date?)` | `GET /api/participants/:id?date=…` |

## PDF-Export (`pdfExport.ts`)

Der Export nutzt **jsPDF** und **jspdf-autotable** und wird per dynamischem
`import()` erst beim ersten Klick geladen (eigener Chunk `pdfExport-*.js`,
hält das Hauptbundle klein).

Inhalt des PDFs (A4 hoch):

1. Titel `<eventName> – Rangliste`
2. Label des Zeitraums (z. B. `Tag 1 - 04.09.2026`)
3. `Erstellt am <Datum, Uhrzeit>` (Format `de-DE`)
4. `Bester / Zweitbester / Drittbester Teiler: <Wert> (<Name>)`
5. Tabelle `Rang | Name | Verein | Bester Teiler | 2. Teiler | Summe | Anzahl`
   mit grünem Kopf (Emerald 600) und Zebra-Streifen
6. Fußzeile `Seite <n>` auf jeder Seite

Dateiname: `rangliste_<datum>.pdf`, z. B. `rangliste_2026-09-04.pdf` oder
`rangliste_all.pdf` für die Gesamtansicht.

## Skripte

| Befehl (in `client/`) | Wirkung |
| --- | --- |
| `npm run dev` | Vite-Dev-Server auf Port 5173 |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | statische Vorschau des Builds |

Vom Repo-Root: `npm run dev:client`, `npm run build:client`.
