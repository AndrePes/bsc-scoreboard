---
title: Tech-Stack
---

# Tech-Stack

Alle drei Applikationen sind in **TypeScript** geschrieben und laufen auf
**Node.js** (Server) bzw. im **Browser** (Client, Live-Board). Es gibt keine
npm-Workspaces; jedes Paket hat eigene `package.json`, `package-lock.json` und
`node_modules`.

## Laufzeitumgebung

| Komponente | Version | Hinweis |
| --- | --- | --- |
| Node.js | **>= 20.19** | Pflicht wegen chokidar 5 |
| npm | >= 9 | Root-Skripte nutzen `npm --prefix` |
| Browser | aktuelle Chromium-/Firefox-/Safari-Versionen | Live-Board nutzt `ResizeObserver` und `requestAnimationFrame` |

## Server (`server/`)

| Paket | Version | Zweck |
| --- | --- | --- |
| `express` | ^4.19 | HTTP-Server und Routing |
| `cors` | ^2.8 | CORS-Header (alle Origins erlaubt) |
| `chokidar` | ^5.0 | Dateisystem-Überwachung des Datenordners |
| `typescript` | ^5.4 | Compiler (`tsc -p tsconfig.json`) |
| `tsx` | ^4.7 | TypeScript-Ausführung mit Watch-Modus für die Entwicklung |
| `@types/express`, `@types/cors`, `@types/node` | – | Typdefinitionen |

Konfiguration: `"type": "module"` (ESM), `target`/`module` ES2022,
`moduleResolution: Bundler`, `strict`, `outDir: dist`, `rootDir: src`.

## Client (`client/`)

| Paket | Version | Zweck |
| --- | --- | --- |
| `react`, `react-dom` | ^18.3 | UI-Bibliothek |
| `jspdf` | ^4.2 | PDF-Erzeugung für den Ranglisten-Export |
| `jspdf-autotable` | ^5.0 | Tabellen-Plugin für jsPDF |
| `vite` | ^5.2 | Dev-Server, Bundler, `/api`-Proxy |
| `@vitejs/plugin-react` | ^4.3 | React-Fast-Refresh und JSX-Transform |
| `tailwindcss` | **^3.4** | Utility-CSS (v3-Syntax mit `tailwind.config.js`) |
| `postcss`, `autoprefixer` | – | CSS-Pipeline für Tailwind |
| `typescript` | ^5.4 | Typprüfung (`tsc -b`) |

## Live-Board (`live_board/`)

Identisch zum Client, jedoch **ohne** `jspdf` und `jspdf-autotable`.

## Gemeinsame Frontend-Konfiguration

| Datei | Inhalt |
| --- | --- |
| `vite.config.ts` | Plugin `react()`, Port 5173 (Client) bzw. 5174 (Live-Board), Proxy `/api` → `http://localhost:4000` (`changeOrigin: true`) |
| `tsconfig.json` | `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit` |
| `tailwind.config.js` | `content: ['./index.html', './src/**/*.{ts,tsx}']`, Farbe `emerald.600 = #059669` |
| `postcss.config.js` | Plugins `tailwindcss`, `autoprefixer` |
| `index.html` | `<html lang="de">`, Favicon `/favicon.svg`, Einstieg `/src/main.tsx` |

## Build-Artefakte

| Paket | Befehl | Ergebnis |
| --- | --- | --- |
| Server | `tsc -p tsconfig.json` | `server/dist/*.js` (ESM), Start mit `node dist/index.js` |
| Client | `tsc -b && vite build` | `client/dist/` (statische Dateien inkl. `config.json`, separater Chunk `pdfExport-*.js`) |
| Live-Board | `tsc -b && vite build` | `live_board/dist/` (statische Dateien inkl. `config.json`) |

## Nicht vorhanden

Bewusst schlank gehalten – es gibt **keine** Tests, **keinen** Linter,
**keinen** Formatter und **keine** CI-Pipeline. Die einzige Verifikation ist
`tsc` plus Build (siehe [Entwicklung](entwicklung.md)). Ebenso gibt es keine
Datenbank, kein Docker-Setup und keine Authentifizierung.
