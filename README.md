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

## REST API

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| `GET` | `/api/event` | Veranstaltungs-Metadaten + alle Tage |
| `GET` | `/api/event/days/:date/participants` | Tagesstatistik + sortierte Teilnehmerliste |
| `GET` | `/api/participants/:id?date=YYYY-MM-DD` | Detailstatistik eines Teilnehmers |
| `GET` | `/api/health` | Health-Check |

## UI-Aufbau

1. **Brand Sidebar (Emerald 600)** – Logo, Titel, Liste der Veranstaltungstage.
2. **Center** – Statistik-Cards (Teilnehmeranzahl, Top-3-Teiler) + sortierte Stacked-List der Teilnehmer.
3. **Details** – Description-List mit Werten des ausgewählten Teilnehmers (Tag & Gesamt).
