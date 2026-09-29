---
title: Entwicklung
---

# Entwicklung

Hinweise für Änderungen am Code: Befehle, Toolchain-Besonderheiten und
Stellen, die bei Erweiterungen zusammen angepasst werden müssen.

## Repository-Struktur

```
.
├── package.json        # nur Skript-Shim (install:all, dev:*, build:*), keine Workspaces
├── README.md           # Kurzanleitung (deutsch)
├── AGENTS.md           # Hinweise für KI-Coding-Agenten
├── schema.json         # JSON-Schema des Anlagen-Exports
├── docs/               # diese Dokumentation (GitHub Pages)
├── server/             # Express-API
├── client/             # React-Client
└── live_board/         # React-Live-Board
```

`.gitignore`: `node_modules`, `dist`, `.DS_Store`, `*.log`. Die Beispieldaten
in `server/data/` und `server/config.json` sind versioniert.

## Befehle

| Zweck | Befehl (Repo-Root) |
| --- | --- |
| Alles installieren | `npm run install:all` |
| Server / Client / Live-Board entwickeln | `npm run dev:server` / `npm run dev:client` / `npm run dev:live` |
| Bauen | `npm run build:server` / `npm run build:client` / `npm run build:live` |
| Nur Typprüfung Server | `cd server && npx tsc -p tsconfig.json --noEmit` |
| Nur Typprüfung Client | `cd client && npx tsc -b --noEmit` |
| Nur Typprüfung Live-Board | `cd live_board && npx tsc -b --noEmit` |

Es gibt **keine Tests, keinen Linter, keinen Formatter und keine CI**.
Vor Abschluss einer Änderung Typprüfung **und** Build aller betroffenen Pakete
ausführen – das ist die einzige Verifikation.

## Toolchain-Besonderheiten

### Server ist ESM

`server/package.json` hat `"type": "module"`. `tsc` schreibt Importpfade nicht
um, daher müssen relative Importe die Endung **`.js`** tragen, obwohl die
Quelldatei `.ts` ist:

```ts
import { loadConfig } from './config.js';   // richtig
import { loadConfig } from './config';      // Laufzeitfehler in dist/
```

Client- und Live-Board-Importe sind dagegen endungslos (Vite/Bundler).

### Ungenutzte Importe brechen den Frontend-Build

`client/tsconfig.json` und `live_board/tsconfig.json` setzen `noUnusedLocals`
und `noUnusedParameters`. Ein ungenutzter Import oder Parameter führt zu
einem Fehler in `tsc -b` und damit im Build.

### Tailwind v3

Beide Frontends verwenden Tailwind **3** mit `tailwind.config.js` und
`postcss.config.js`. Die v4-Syntax (`@import "tailwindcss"`, `@theme`) gilt
nicht.

### `dist/` wird nicht bereinigt

`tsc` löscht `server/dist/` nicht. Nach dem Entfernen oder Umbenennen von
Quelldateien bleiben alte `.js`-Dateien liegen:

```bash
rm -rf server/dist && npm run build:server
```

### Node-Version

chokidar 5 setzt Node **>= 20.19** voraus. Ältere Versionen scheitern bereits
bei `npm install`.

## Typen sind dreifach vorhanden

Die Pakete teilen keinen Code. API-Antwortformen existieren in

- `server/src/index.ts` (`ParticipantStats`, `TopTeiler`, Antwortobjekte) und
  `server/src/types.ts` (Rohformat, internes Modell),
- `client/src/types.ts`,
- `live_board/src/types.ts`.

Beim Ändern einer Antwort (neues Feld, umbenanntes Feld) alle drei Stellen
anpassen und beide Frontend-Builds prüfen.

## Häufige Erweiterungen

### Neues Feld aus der Rohdatei verwenden

1. Feld in `server/src/types.ts` (`Raw*`) und ggf. `SessionResult` /
   `Participant` ergänzen.
2. In `server/src/parser.ts` auslesen (mit Validierung, optional → kein
   `ParseError`).
3. In `server/src/store.ts` in den Teilnehmer übernehmen.
4. In `server/src/index.ts` in die Antwort aufnehmen.
5. `client/src/types.ts` und `live_board/src/types.ts` nachziehen, UI anpassen.
6. [REST-API](api.md) und [Datenformat](datenformat.md) aktualisieren.

### Sortierung ändern

- Client/Server-Rangliste: `index.ts`, `buildDayResponse` – Sortierfunktion
  `(a, b) => a.bestTeiler - b.bestTeiler`.
- Live-Board: `live_board/src/api.ts`, `compareBySum` / `rankBySum`.

### Server-Port ändern

`PORT` setzen **und** die Proxy-Ziele in `client/vite.config.ts` sowie
`live_board/vite.config.ts` anpassen.

### Anzahl der Kacheln im Live-Board

`TOP_COUNT` in `live_board/src/App.tsx` und `SLOTS` sowie `grid-cols-5` in
`live_board/src/components/TopFive.tsx`.

## Debugging

- Server-Logs sind mit `[config]` und `[monitor]` präfixiert; alle Meldungen
  sind deutsch.
- `GET /api/health` zeigt den tatsächlich verwendeten `dataDir` – hilfreich
  bei Pfadproblemen (relative Pfade werden gegen `server/` aufgelöst).
- Frontend: `config.json`-Fehler erscheinen als `console.warn`
  (`config.json konnte nicht geladen werden, verwende Standardwerte.`).
- Live-Board bei mehreren Tagen: einzelne Tagesfehler stehen als
  `console.warn` (`Tag <date> konnte nicht geladen werden`).

## Bekannte Unschärfen im Code

Hilfreich zu wissen, bevor man an den entsprechenden Stellen arbeitet:

- `client/src/api.ts` kodiert das Datum in `getDayParticipants` nicht mit
  `encodeURIComponent` (Live-Board tut es). Für `YYYY-MM-DD` unkritisch.
- Client-Fetches setzen kein `cache: 'no-store'`; das Live-Board schon.
- `ResultValid` aus `ParameterResults` wird typisiert, aber nicht geprüft.
- Der Doc-Kommentar zu `LiveBoardData.ranking` („aufsteigend nach bestem
  Teiler“) ist veraltet – sortiert wird nach Summe.
- `tsconfig.json` der Frontends referenziert `tsconfig.node.json` nicht;
  `vite.config.ts` wird von `tsc -b` nicht geprüft.
- `PORT` wird nicht validiert (`PORT=abc` → `NaN`).

## Dokumentation pflegen

Diese Dokumentation liegt in `docs/` und wird über GitHub Pages
veröffentlicht (Quelle: Branch `main`, Ordner `/docs`, Theme Cayman via
`docs/_config.yml`). Neue Seiten als Markdown mit Front-Matter (`title`)
anlegen und in `docs/index.md` verlinken. Relative Links auf `.md`-Dateien
werden von Jekyll (`jekyll-relative-links`) automatisch umgeschrieben und
funktionieren auch direkt auf GitHub.
