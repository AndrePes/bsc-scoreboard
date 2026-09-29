---
title: Installation
---

# Installation

## Voraussetzungen

| Software | Version | Prüfen mit |
| --- | --- | --- |
| Node.js | **20.19 oder neuer** (chokidar 5) | `node -v` |
| npm | 9 oder neuer | `npm -v` |
| Git | beliebig | `git --version` |

Node.js gibt es unter <https://nodejs.org/> (LTS-Version wählen). Unter
macOS/Linux bietet sich zusätzlich ein Versionsmanager wie `nvm` an:

```bash
nvm install 22
nvm use 22
```

## Repository klonen

```bash
git clone https://github.com/AndrePes/bsc-scoreboard.git
cd bsc-scoreboard
```

## Abhängigkeiten installieren

Das Projekt verwendet **keine npm-Workspaces**. Jedes der drei Pakete
(`server/`, `client/`, `live_board/`) besitzt eine eigene `package.json` und
`package-lock.json`. Das Root-Skript installiert alle drei nacheinander:

```bash
npm run install:all
```

Das entspricht:

```bash
npm --prefix server install
npm --prefix client install
npm --prefix live_board install
```

Ein einfaches `npm install` im Root installiert **nichts Nützliches**, da die
Root-`package.json` nur Skripte enthält.

### Einzelne Pakete installieren

Wird auf einem Rechner nur eine Komponente benötigt (z. B. nur der Server auf
dem Wettkampf-PC), reicht das entsprechende Paket:

```bash
npm --prefix server install
```

### Abhängigkeit hinzufügen

Immer mit `--prefix` auf das Zielpaket:

```bash
npm --prefix client install <paket>
npm --prefix server install -D <paket>
```

## Installation prüfen

```bash
# Server starten (lädt die Beispieldaten aus server/data/raw)
npm run dev:server
```

Erwartete Ausgabe (gekürzt):

```
[monitor] Initial 67 von 67 Datei(en) aus /…/server/data/raw geladen
[monitor] Überwache /…/server/data/raw (Dateisystem-Events)
BSC ScoreBoard Server listening on http://localhost:4000
```

In einem zweiten Terminal:

```bash
curl http://localhost:4000/api/health
# {"status":"ok","dataDir":"…/server/data/raw","files":67,"participants":…}
```

Anschließend Client und Live-Board starten:

```bash
npm run dev:client   # http://localhost:5173
npm run dev:live     # http://localhost:5174
```

## Nächste Schritte

- Datenordner der Schießanlage eintragen: [Konfiguration](konfiguration.md)
- Production-Build und Betrieb ohne Dev-Server: [Ausführen und Betrieb](betrieb.md)

## Häufige Probleme

| Symptom | Ursache / Lösung |
| --- | --- |
| `npm run install:all` bricht mit Engine-Fehler bei `chokidar` ab | Node.js < 20.19. Node aktualisieren. |
| `Cannot find module './data.js'` o. ä. beim Serverstart aus `dist/` | Veraltete Dateien in `server/dist`. `rm -rf server/dist && npm run build:server`. |
| Client zeigt `Fehler beim Laden der Veranstaltung: Request failed: 404` | Server läuft nicht oder `apiBaseUrl` zeigt auf falschen Host/Port. |
| Build des Clients schlägt mit `'x' is declared but its value is never read` fehl | `noUnusedLocals` ist aktiv – ungenutzte Importe/Variablen entfernen. |
| Server erkennt neue Dateien auf einem Netzlaufwerk nicht | `usePolling: true` in `server/config.json` setzen. |
