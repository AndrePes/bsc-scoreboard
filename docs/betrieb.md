---
title: Ausführen und Betrieb
---

# Ausführen und Betrieb

## Entwicklung

Drei Prozesse in separaten Terminals, jeweils vom Repo-Root:

```bash
npm run dev:server   # Express + tsx watch, Port 4000
npm run dev:client   # Vite, Port 5173, Proxy /api -> :4000
npm run dev:live     # Vite, Port 5174, Proxy /api -> :4000
```

| URL | Anwendung |
| --- | --- |
| <http://localhost:4000/api/health> | Server (API) |
| <http://localhost:5173> | Client |
| <http://localhost:5174> | Live-Board |

- Der Server startet bei Codeänderungen automatisch neu (`tsx watch`).
- Die Frontends nutzen Vite Hot Module Replacement.
- In der Entwicklung bleibt `apiBaseUrl` leer; der Vite-Proxy leitet `/api`
  an den Server weiter.
- Ohne Konfigurationsänderung werden die Beispieldaten aus
  `server/data/raw/20260904/Exercise/raw/` geladen (67 Dateien, ein
  Veranstaltungstag). Da kein Ordner für den heutigen Tag existiert, meldet
  der Server `Tagesordner … existiert noch nicht, warte auf die Schießanlage …`
  – das ist im Dev-Betrieb normal.

### Neue Dateien simulieren

Um das Live-Verhalten zu testen, den heutigen Tagesordner anlegen und eine
Beispieldatei hineinkopieren:

```bash
TODAY=$(date +%Y%m%d)
mkdir -p server/data/raw/$TODAY/Exercise/raw
cp server/data/raw/20260904/Exercise/raw/20260904-184337_2_179016_ExerciseResultData.json \
   server/data/raw/$TODAY/Exercise/raw/test_ExerciseResultData.json
```

Innerhalb von 5 s erkennt der Server den neuen Ordner
(`[monitor] Überwache …/<heute>/Exercise/raw`) und lädt die Datei. Weitere
Kopien protokolliert er als `[monitor] Neu: …` (beachte: gleiche `Id` →
Duplikat, die Datei mit dem kleineren Pfad gewinnt). Löschen erzeugt
`[monitor] Entfernt: …`. Den Testordner anschließend wieder entfernen.

## Production-Build

```bash
npm run build:server   # -> server/dist/
npm run build:client   # -> client/dist/
npm run build:live     # -> live_board/dist/
```

| Paket | Ausgabe | Inhalt |
| --- | --- | --- |
| Server | `server/dist/` | ESM-JavaScript, Start mit `node dist/index.js` |
| Client | `client/dist/` | `index.html`, `assets/`, `config.json`, `favicon.svg` |
| Live-Board | `live_board/dist/` | `index.html`, `assets/`, `config.json`, `favicon.svg` |

Die Frontend-Builds prüfen Typen (`tsc -b`) und brechen bei ungenutzten
Importen ab (`noUnusedLocals`). Nur der Build ist die Verifikation – es gibt
keine Tests.

## Server im Produktivbetrieb

```bash
cd server
npm run build
npm start                       # node dist/index.js, Port 4000
# oder mit Umgebungsvariablen:
PORT=4000 DATA_DIR=/pfad/zum/export node dist/index.js
```

Der Server benötigt zur Laufzeit nur `server/dist/`, `server/node_modules/`
(Produktions-Abhängigkeiten: `express`, `cors`, `chokidar`) und
`server/config.json`. Für eine schlanke Installation auf dem Ziel-Rechner:

```bash
npm --prefix server ci --omit=dev
```

### Dauerhaft laufen lassen

Der Server hat keinen eigenen Dienst-Modus. Bewährte Optionen:

**pm2** (plattformübergreifend):

```bash
npm install -g pm2
pm2 start server/dist/index.js --name bsc-scoreboard --cwd server
pm2 save
pm2 startup      # Anweisung für Autostart folgen
```

**systemd** (Linux) – `/etc/systemd/system/bsc-scoreboard.service`:

```ini
[Unit]
Description=BSC ScoreBoard Server
After=network.target

[Service]
WorkingDirectory=/opt/bsc-scoreboard/server
ExecStart=/usr/bin/node dist/index.js
Environment=PORT=4000
Environment=DATA_DIR=/mnt/anlage/RangePrinterExport
Restart=on-failure
User=scoreboard

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now bsc-scoreboard
journalctl -u bsc-scoreboard -f
```

Ein Neustart ist unkritisch: Der Server baut seinen Zustand beim Start
vollständig aus allen Tagesordnern des Export-Ordners neu auf. Bei einem
mehrtägigen Wettkampf kann der Server durchlaufen – um Mitternacht wechselt
er selbstständig auf den neuen Tagesordner, die Vortage bleiben geladen.

## Frontends bereitstellen

Der Server liefert **keine** statischen Dateien aus. `client/dist/` und
`live_board/dist/` sind reine statische Sites und können mit jedem Webserver
ausgeliefert werden. In jedem Fall muss `dist/config.json` die Adresse des
Servers enthalten (siehe [Konfiguration](konfiguration.md)).

### Variante A: `vite preview` (einfach, lokal)

```bash
npm --prefix client run preview -- --host --port 5173
npm --prefix live_board run preview -- --host --port 5174
```

Kein Proxy im Preview-Modus – `apiBaseUrl` muss gesetzt sein
(z. B. `"http://localhost:4000"`).

### Variante B: statischer Webserver

```bash
npm install -g serve
serve -l 8080 client/dist
serve -l 8081 live_board/dist
```

### Variante C: nginx mit Reverse-Proxy

Frontends und API unter einem Host; `apiBaseUrl` bleibt `""`:

```nginx
server {
    listen 80;

    location / {
        root /opt/bsc-scoreboard/client/dist;
        try_files $uri /index.html;
    }

    location /live/ {
        alias /opt/bsc-scoreboard/live_board/dist/;
        try_files $uri /live/index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
    }
}
```

Hinweis: `index.html` referenziert das Favicon absolut als `/favicon.svg`.
Für den Betrieb unter einem Unterpfad wie `/live/` ist in `vite.config.ts`
ein `base: '/live/'` zu setzen und neu zu bauen; `config.json` wird bereits
relativ zu `import.meta.env.BASE_URL` geladen.

### Variante D: Frontend direkt vom Server-Rechner

Server, Client und Live-Board auf einem Rechner, Monitore greifen per Browser
über das Netz zu:

```
Server-PC (192.168.1.50)
  node server/dist/index.js        -> :4000
  serve -l 8080 client/dist        -> :8080   (apiBaseUrl: "http://192.168.1.50:4000")
  serve -l 8081 live_board/dist    -> :8081   (apiBaseUrl: "http://192.168.1.50:4000")

Monitor-PC
  chrome --kiosk http://192.168.1.50:8081/
```

## Live-Board im Kiosk-Modus

Das Live-Board ruft keine Vollbild-API auf; der Browser wird im Kiosk-Modus
gestartet.

**Chrome / Chromium**

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-infobars http://192.168.1.50:8081/

# Linux (z. B. Raspberry Pi)
chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://192.168.1.50:8081/

# macOS
open -a "Google Chrome" --args --kiosk http://192.168.1.50:8081/
```

**Firefox**

```bash
firefox --kiosk http://192.168.1.50:8081/
```

Empfehlungen:

- Bildschirmschoner und Energiesparmodus des Monitor-PCs deaktivieren.
- `visibleRows` an die Monitorgröße anpassen (Zeilenhöhe = Höhe des
  Tabellenbereichs / `visibleRows`).
- `refreshIntervalSec` auf 30–60 s setzen; kürzere Intervalle sind unnötig,
  da die Anlage pro Durchgang nur eine Datei schreibt.
- Bei mehreren Monitoren dieselbe URL verwenden; jede Instanz lädt
  unabhängig.

## Betriebsüberwachung

| Prüfung | Befehl / Ort |
| --- | --- |
| Server erreichbar, Dateien geladen | `curl http://<server>:4000/api/health` |
| Heutiger Tagesordner wird überwacht | `/api/health` → `watchDir` ist nicht `null` und entspricht `todayDir` |
| Neue Datei erkannt | Server-Log `[monitor] Neu: …` |
| Datei übersprungen | Server-Log `[monitor] … übersprungen: <Grund>` |
| Live-Board hat Verbindung | Header zeigt `Letzte Aktualisierung HH:MM:SS`, kein rotes `Verbindungsfehler`-Badge |
| Watcher-Modus | Server-Log `Überwache … (Dateisystem-Events)` bzw. `(Polling, …)` |

## Typische Störungen

| Störung | Maßnahme |
| --- | --- |
| Neue Durchgänge erscheinen nicht | `/api/health` → `watchDir` prüfen: `null` heißt, der heutige Tagesordner (`todayDir`) existiert nicht – stimmen Datum des Server-Rechners und Ordnername der Anlage überein? Zeigt `dataDir` auf die **Wurzel** (nicht auf einen Tagesordner)? Netzlaufwerk → `usePolling: true`. |
| `watchDir` zeigt auf den falschen Tag | Datum/Zeitzone des Server-Rechners korrigieren; der Server wechselt innerhalb von 5 s auf den richtigen Ordner. |
| Live-Board zeigt `Verbindungsfehler` | `apiBaseUrl` in `dist/config.json` prüfen; Firewall auf Port 4000; Server läuft? |
| Vite meldet `http proxy error: /api/event … ECONNREFUSED` | `apiBaseUrl` ist leer, daher geht die Anfrage über den Dev-Proxy an `localhost:4000`, wo kein Server läuft. Entweder `npm run dev:server` starten oder `apiBaseUrl` in `public/config.json` (nicht in `src/config.ts`) auf den Server-Rechner setzen. |
| Teilnehmer fehlt in der Rangliste | Server-Log auf `übersprungen` prüfen (fehlende `MemberId`, `LastShot`, `Teilers`). |
| Tag fehlt in der Sidebar | Datum stammt aus `LastShot.TimeStamp`; Uhrzeit/Zeitzone der Anlage prüfen. |
| Ranglisten von Client und Live-Board unterscheiden sich | Beide sortieren nach Summe. Unterschiede entstehen nur, wenn das Live-Board über `dates` andere Tage anzeigt als im Client gewählt sind. |
