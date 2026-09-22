# BSC ScoreBoard

Single-Page-Application zur Anzeige von Schießwettkampf-Ergebnissen.

## Struktur

```
.
├── client/   # BSC ScoreBoard (React + Vite + TypeScript + Tailwind)
└── server/   # BSC ScoreBoard Server (Express + TypeScript) – REST API
```

Der Server liest eine interne Datenstruktur (basierend auf dem `schema.json`) und stellt sie als JSON unter `/api` bereit. Das Frontend konsumiert diese API und rendert das 3-Spalten-Layout.

## Voraussetzungen

- Node.js 18+
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
```

Anschließend `http://localhost:5173` im Browser öffnen.

## Production-Build

```bash
npm run build:server
npm run build:client
```

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

## REST API

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| `GET` | `/api/event` | Veranstaltungs-Metadaten + alle Tage |
| `GET` | `/api/event/days/:date/participants` | Tagesstatistik + sortierte Teilnehmerliste |
| `GET` | `/api/event/all/participants` | Statistik + Teilnehmerliste über alle Tage |
| `GET` | `/api/participants/:id?date=YYYY-MM-DD` | Detailstatistik eines Teilnehmers |
| `GET` | `/api/health` | Health-Check |

Die Teilnehmerlisten enthalten pro Teilnehmer `bestTeiler`, `secondBestTeiler`
und `teilerSum` (Summe aus bestem und zweitbestem Teiler). Die Top-3-Werte in
`stats` (`bestTeiler`, `secondBestTeiler`, `thirdBestTeiler`) sind Objekte mit
`teiler`, `participantId`, `firstName`, `lastName`.

## UI-Aufbau

1. **Brand Sidebar (Emerald 600)** – Logo, Titel, Liste der Veranstaltungstage.
2. **Center** – Statistik-Cards (Top-3-Teiler inkl. Name des Schützen) + sortierte Rangliste
   der Teilnehmer (bester Teiler, zweitbester Teiler, Summe). Über der Rangliste kann
   diese als PDF exportiert werden.
3. **Details** – Description-List mit Werten des ausgewählten Teilnehmers (Tag & Gesamt).
