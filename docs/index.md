---
title: Übersicht
---

# BSC ScoreBoard – Dokumentation

BSC ScoreBoard ist ein Anzeigesystem für Schießwettkämpfe, bei denen der
**Teiler** (Abstand des Schusses vom Scheibenzentrum) gewertet wird. Die
Schießanlage schreibt nach jedem Durchgang eine JSON-Datei in einen Ordner;
das System liest diese Dateien automatisch ein, berechnet Ranglisten und zeigt
sie in einer Web-Oberfläche sowie auf großen Monitoren über der Schießbahn an.

Das Projekt besteht aus drei eigenständigen Applikationen:

| Applikation | Ordner | Zweck |
| --- | --- | --- |
| [Server](server.md) | `server/` | REST-API; liest alle Tagesordner des Export-Ordners der Schießanlage, überwacht den heutigen und stellt die Auswertung bereit |
| [Client](client.md) | `client/` | Web-Oberfläche für die Wettkampfleitung: Tagesauswahl, Rangliste, Teilnehmerdetails, PDF-Export |
| [Live-Board](live-board.md) | `live_board/` | Vollbild-Ansicht für Monitore am Schießstand: Top 5 als Kacheln, automatisch scrollende Tabelle |

## Inhalt

### Grundlagen

- [Architektur](architektur.md) – Komponenten, Datenfluss, Domänenregeln
- [Tech-Stack](techstack.md) – verwendete Technologien und Versionen
- [Datenformat der Schießanlage](datenformat.md) – Aufbau der `*_ExerciseResultData.json`

### Applikationen

- [Server](server.md) – Aufbau, File-Monitor, Parser, Store
- [REST-API](api.md) – alle Endpunkte mit Antwortformaten
- [Client](client.md) – Oberfläche, Bedienung, PDF-Export
- [Live-Board](live-board.md) – Kachel-Ansicht, Auto-Scroll, Zusammenführen mehrerer Tage

### Anleitungen

- [Installation](installation.md) – Voraussetzungen und Einrichtung
- [Konfiguration](konfiguration.md) – alle Konfigurationsdateien und Umgebungsvariablen
- [Ausführen und Betrieb](betrieb.md) – Entwicklung, Production-Build, Deployment, Kiosk-Modus
- [Entwicklung](entwicklung.md) – Befehle, Toolchain-Besonderheiten, Erweiterungshinweise

## Schnellstart

```bash
git clone https://github.com/AndrePes/bsc-scoreboard.git
cd bsc-scoreboard
npm run install:all

# drei Terminals:
npm run dev:server   # http://localhost:4000  (REST-API)
npm run dev:client   # http://localhost:5173  (Client)
npm run dev:live     # http://localhost:5174  (Live-Board)
```

Ohne weitere Konfiguration verwendet der Server die Beispieldaten aus
`server/data/raw/20260904/Exercise/raw/`. Für den Wettkampfbetrieb wird in
`server/config.json` die Wurzel des Export-Ordners der Schießanlage
eingetragen (z. B. `C:/temp/RangePrinterExport`); den Tagesordner
`YYYYMMDD/Exercise/raw` ergänzt der Server selbst
(siehe [Konfiguration](konfiguration.md)).

## Zentrale Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Teiler** | Abstand des Schusses vom Zentrum der Scheibe. Die Anlage liefert Meter, das System rechnet in **1/100 mm** um (eine Nachkommastelle). **Kleiner ist besser.** |
| **Durchgang** | Eine Schießserie eines Teilnehmers = eine JSON-Datei der Anlage. Jede Datei liefert die **3 besten Teiler** des Durchgangs. |
| **Veranstaltungstag** | Wird aus dem Datum von `LastShot.TimeStamp` abgeleitet (nicht aus dem Ordnernamen). Es gibt keine feste Tagesliste. |
| **Tagesordner** | Ordner `YYYYMMDD` (z. B. `20260929`), den die Anlage pro Tag unter dem Export-Ordner anlegt; die Dateien liegen darunter in `Exercise/raw/`. Der Server überwacht nur den Tagesordner des heutigen Datums. |
| **Bester / zweitbester Teiler** | Tagesansicht: die beiden kleinsten Teiler des Tages. Gesamtansicht: bei mehreren Tagen die zwei kleinsten **Tagesbestwerte** (aus verschiedenen Tagen), bei einem Tag wie in der Tagesansicht. |
| **Summe (`teilerSum`)** | Bester + zweitbester Teiler. Sortierkriterium im Live-Board. |
| **Anzahl (`teilerCount`)** | Anzahl gewerteter Teiler-Werte (nicht Schüsse). |
