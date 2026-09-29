---
title: Konfiguration
---

# Konfiguration

Alle drei Applikationen werden über JSON-Dateien konfiguriert, die **zur
Laufzeit** gelesen werden. Änderungen an den Frontend-Konfigurationen
benötigen keinen neuen Build; der Server liest seine Konfiguration beim Start.

| Applikation | Datei | Nach dem Build |
| --- | --- | --- |
| Server | `server/config.json` | unverändert (`server/config.json`) |
| Client | `client/public/config.json` | `client/dist/config.json` |
| Live-Board | `live_board/public/config.json` | `live_board/dist/config.json` |

## Server: `server/config.json`

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

| Schlüssel | Typ | Standard | Bedeutung |
| --- | --- | --- | --- |
| `dataDir` | string | `./data/raw` | **Wurzel** des Export-Ordners der Schießanlage. Die Anlage legt darunter pro Tag einen Ordner `YYYYMMDD` an; der Server vervollständigt den Pfad automatisch zu `<dataDir>/<YYYYMMDD>/<daySubDir>`. **Relative Pfade beziehen sich auf `server/`**, nicht auf das Arbeitsverzeichnis. Die Wurzel wird beim Start angelegt, falls sie fehlt. |
| `daySubDir` | string | `Exercise/raw` | Unterpfad innerhalb eines Tagesordners zu den JSON-Dateien. Backslashes sind erlaubt (`"Exercise\\raw"`). |
| `usePolling` | boolean | `false` | `true`, wenn der Ordner auf einem Netzlaufwerk (SMB/NFS) liegt, das keine Dateisystem-Events liefert. |
| `pollingIntervalMs` | number > 0 | `1000` | Abfrageintervall in Millisekunden bei `usePolling`. |
| `eventName` | string | `BSC ScoreBoard` | Name der Veranstaltung; wird in Client und Live-Board angezeigt. |
| `rangeName` | string | `Schießanlage BSC` | Name der Anlage; wird in Client und Live-Board angezeigt. |

Ungültige Werte fallen einzeln auf den Standard zurück. Fehlt die Datei ganz,
läuft der Server mit den Standardwerten und protokolliert eine Warnung.

### Ordnerstruktur und Überwachung

```
C:\temp\RangePrinterExport\           <- dataDir
├── 20260928\Exercise\raw\*.json      <- wird beim Start gelesen
└── 20260929\Exercise\raw\*.json      <- heute: wird gelesen UND überwacht
```

- Beim Start werden **alle** Tagesordner gelesen.
- Überwacht wird **nur der Ordner des heutigen Tages** (Datum des
  Server-Rechners, lokale Zeit). Existiert er noch nicht, wartet der Server
  und prüft alle 5 Sekunden; um Mitternacht wechselt er automatisch auf den
  neuen Tagesordner.

### Beispiele

Lokaler Export-Ordner der Anlage unter Windows (absoluter Pfad, Schrägstriche
oder doppelte Backslashes verwenden):

```json
{
  "dataDir": "C:/temp/RangePrinterExport",
  "usePolling": false,
  "eventName": "Vereinsmeisterschaft 2026",
  "rangeName": "BSC Isenbüttel, 10 m"
}
```

Daraus ergibt sich am 29.09.2026 der überwachte Ordner
`C:\temp\RangePrinterExport\20260929\Exercise\raw`.

Netzlaufwerk mit Polling:

```json
{
  "dataDir": "//ANLAGE-PC/RangePrinterExport",
  "usePolling": true,
  "pollingIntervalMs": 2000
}
```

### Umgebungsvariablen des Servers

Umgebungsvariablen haben Vorrang vor der Datei.

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `PORT` | HTTP-Port der API | `4000` |
| `DATA_DIR` | Überschreibt `dataDir`. Relative Pfade werden gegen `server/` aufgelöst. | – |
| `CONFIG_PATH` | Alternative Konfigurationsdatei (relativ zu `server/` oder absolut) | `config.json` |

```bash
PORT=8080 DATA_DIR=/mnt/anlage/results npm run dev:server
CONFIG_PATH=config.wettkampf.json npm --prefix server start
```

Wird `PORT` geändert, müssen für die Entwicklung auch die Proxy-Ziele in
`client/vite.config.ts` und `live_board/vite.config.ts` angepasst werden
(beide zeigen auf `http://localhost:4000`).

## Client: `client/public/config.json`

```json
{
  "apiBaseUrl": ""
}
```

| Schlüssel | Typ | Standard | Bedeutung |
| --- | --- | --- | --- |
| `apiBaseUrl` | string | `""` | Basis-Adresse des Servers ohne `/api`. Leer = gleicher Host wie die Seite (Dev: Vite-Proxy `/api` → `:4000`). |

| Wert | Einsatz |
| --- | --- |
| `""` | Entwicklung mit Vite-Proxy oder Frontend und API hinter demselben Reverse-Proxy |
| `"http://192.168.1.50:4000"` | Server läuft auf einem anderen Rechner im Netz |
| `"http://localhost:4000"` | Build lokal mit `vite preview` oder anderem Webserver, Server lokal |

Abschließende Schrägstriche werden entfernt. Ist die Datei nicht ladbar,
gilt `""`. Der Server erlaubt CORS für alle Origins, daher sind keine weiteren
Einstellungen nötig. Die Adresse **nicht** in `client/src/config.ts`
eintragen – dort steht nur der Fallback; die Datei `config.json` ist die
vorgesehene Stelle und wirkt ohne Rebuild.

## Live-Board: `live_board/public/config.json`

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

| Schlüssel | Typ | Standard | Bedeutung |
| --- | --- | --- | --- |
| `apiBaseUrl` | string | `""` | wie beim Client |
| `dates` | string[] | `[]` | Anzuzeigende Tage als `["YYYY-MM-DD", …]`. `[]` = alle Tage (Server-Aggregat). Ein Datum = nur dieser Tag. Mehrere = werden im Live-Board zusammengeführt. Ungültige Einträge werden ignoriert. |
| `refreshIntervalSec` | number > 0 | `60` | Intervall für das Neuladen der Daten in Sekunden. |
| `scrollSpeedPxPerSec` | number > 0 | `24` | Scrollgeschwindigkeit der Tabelle in Pixel pro Sekunde. |
| `scrollPauseSec` | number ≥ 0 | `3` | Pause am Anfang und am Ende der Tabelle in Sekunden. |
| `visibleRows` | integer ≥ 1 | `6` | Anzahl gleichzeitig sichtbarer Tabellenzeilen; bestimmt die Zeilenhöhe (Viewport / `visibleRows`). |

**Wichtig:** Die Server-Adresse gehört in diese Datei, **nicht** in
`live_board/src/config.ts` (`DEFAULT_CONFIG`). Der Code-Default `""` ist
nur der Fallback, wenn `config.json` nicht ladbar ist. Bleibt `apiBaseUrl`
im Dev-Betrieb leer, gehen alle Anfragen über den Vite-Proxy an
`localhost:4000`; läuft dort kein Server, meldet Vite
`http proxy error: /api/event … ECONNREFUSED`. Mit gesetzter `apiBaseUrl`
ruft der Browser den Server direkt auf und der Proxy ist nicht beteiligt.
Die Datei wird bei jedem Seitenaufruf frisch geladen (`cache: 'no-store'`),
ein Neustart des Dev-Servers ist nicht nötig.

### Beispiele

Wettkampf über zwei Tage, Server auf separatem Rechner, großer Monitor mit
8 Zeilen:

```json
{
  "apiBaseUrl": "http://192.168.1.50:4000",
  "dates": ["2026-09-04", "2026-09-05"],
  "refreshIntervalSec": 30,
  "scrollSpeedPxPerSec": 30,
  "scrollPauseSec": 4,
  "visibleRows": 8
}
```

Nur der aktuelle Tag:

```json
{
  "apiBaseUrl": "http://192.168.1.50:4000",
  "dates": ["2026-09-05"]
}
```

Fehlende Schlüssel erhalten den Standardwert.

## Entwicklungs-Konfiguration (Build-Zeit)

Diese Werte sind im Code festgelegt und erfordern einen Neustart des
Dev-Servers bzw. einen Rebuild:

| Datei | Einstellung | Wert |
| --- | --- | --- |
| `client/vite.config.ts` | Dev-Port / Proxy-Ziel | `5173` / `http://localhost:4000` |
| `live_board/vite.config.ts` | Dev-Port / Proxy-Ziel | `5174` / `http://localhost:4000` |
| `client/tailwind.config.js`, `live_board/tailwind.config.js` | Akzentfarbe | `emerald.600 = #059669` |
| `live_board/src/App.tsx` | Anzahl Kacheln | `TOP_COUNT = 5` |

## Checkliste für den Wettkampftag

1. `server/config.json`: `dataDir` auf die **Wurzel** des Exportordners der
   Anlage setzen (ohne Tagesordner), ggf. `usePolling: true`;
   `eventName`/`rangeName` anpassen.
2. Datum/Uhrzeit des Server-Rechners prüfen – daraus ergibt sich der
   überwachte Tagesordner.
3. Server starten und `GET /api/health` prüfen: `watchDir` zeigt den
   heutigen Ordner, sobald die Anlage ihn angelegt hat; `files` steigt, wenn
   die Anlage schreibt.
4. `client/dist/config.json` und `live_board/dist/config.json`: `apiBaseUrl`
   auf die IP des Server-Rechners setzen.
5. `live_board/dist/config.json`: `dates` auf den/die Wettkampftag(e) setzen
   oder leer lassen.
6. Browser auf dem Monitor im Kiosk-Modus starten (siehe [Betrieb](betrieb.md)).
