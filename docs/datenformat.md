---
title: Datenformat der Schießanlage
---

# Datenformat der Schießanlage

Die Schießanlage (Artemis-System) schreibt nach jedem abgeschlossenen
Durchgang eine JSON-Datei in den Datenordner. Das vollständige Format ist im
Repository als JSON-Schema dokumentiert (`schema.json`, Titel
„ExcerciseResult Schmema“); Beispieldateien liegen in `server/data/raw/`.

## Dateiname

```
YYYYMMDD-HHMMSS_<FiringPoint>_<MemberId>_ExerciseResultData.json
```

Beispiel: `20260904-184337_2_179016_ExerciseResultData.json`
(4. September 2026, 18:43:37 Uhr, Stand 2, Mitglied 179016).

Der Dateiname wird vom Server **nicht** ausgewertet; alle Informationen werden
aus dem JSON-Inhalt gelesen. Der Watcher berücksichtigt alle Dateien mit der
Endung `.json` (unabhängig von Groß-/Kleinschreibung) auf der obersten Ebene
des Datenordners.

## Verwendete Felder

Von den über 40 Top-Level-Feldern werden nur die folgenden ausgewertet:

| JSON-Pfad | Pflicht | Bedeutung |
| --- | --- | --- |
| `UserSessionInformation.UserData.MemberId` | **ja** | Teilnehmer-Nummer, dient als eindeutige ID (`id` in der API) |
| `UserSessionInformation.UserData.FirstName` | nein | Vorname (leer, wenn fehlend) |
| `UserSessionInformation.UserData.Name` | nein | Nachname (leer, wenn fehlend) |
| `UserSessionInformation.UserData.Club` | nein | Verein; leere Zeichenkette wird zu „nicht vorhanden“ |
| `ParameterResults[].Teilers` | **ja** | Die besten Teiler des Durchgangs in **Metern**, aufsteigend |
| `ParameterResults[].ParameterResultType` | nein | Bevorzugt wird der Eintrag mit `"Bester Teiler"`, sonst der erste mit `Teilers` |
| `LastShot.TimeStamp` | **ja** | ISO-8601 mit Offset, z. B. `2026-09-04T18:43:35.819+02:00`; der Datumsanteil bestimmt den Veranstaltungstag |
| `Id` | nein | Eindeutige ID des Durchgangs (GUID). Fehlt sie, wird `<MemberId>@<TimeStamp>` verwendet |

Nicht ausgewertet werden u. a. `Organization`, `UserGroup`, `DisplayName`,
`RangeName`, `ExerciseName`, `FiringPoint`, `Totals`, `Practices` und
`ResultValid`.

## Beispiel (gekürzt)

```json
{
  "Id": "0cfb2c70-51d0-45e2-bc8e-ac8e5002981d",
  "LastShot": {
    "TimeStamp": "2026-09-04T18:43:35.819+02:00",
    "ShotNumber": 10
  },
  "UserSessionInformation": {
    "SessionId": "01a06d45-9d28-79cf-9f7e-d3283d6eebcb",
    "UserData": {
      "MemberId": "179016",
      "Name": "Meyer",
      "FirstName": "Bernd",
      "DisplayName": "MEYER Bernd",
      "Club": "",
      "UserGroup": "Seniorenzug",
      "Organization": "BSC Isenbüttel von 1852 e.V."
    }
  },
  "ParameterResults": [
    {
      "Teilers": [
        0.00034177382181788,
        0.0008188083567453376,
        0.0010313552749387574
      ],
      "ParameterResultType": "Bester Teiler",
      "ResultValid": true
    }
  ],
  "RangeName": "DEU Isenbüttel 10m 10x SR24 LS10",
  "ExerciseName": "10 Schuss, 5 Probe",
  "FiringPoint": 2,
  "TimeZone": "Europe/Berlin"
}
```

Ergebnis nach dem Parsen:

| Feld | Wert |
| --- | --- |
| `memberId` | `179016` |
| `firstName` / `lastName` | `Bernd` / `Meyer` |
| `club` | – (leer → `undefined`, erscheint nicht in der API) |
| `date` | `2026-09-04` |
| `teilers` | `[34.2, 81.9, 103.1]` (1/100 mm) |

## Umrechnung der Teiler

```
teiler_1/100mm = round(meter * 100000 * 10) / 10
```

`0.00034177 m` = `0.34177 mm` = `34.177` 1/100 mm → gerundet `34.2`.

Nur endliche Zahlen ≥ 0 werden übernommen; andere Einträge werden stillschweigend
verworfen. Das Ergebnis wird aufsteigend sortiert.

## Ableitung des Veranstaltungstags

Der Parser entnimmt das Datum direkt aus dem Zeitstempel-String
(`^(\d{4}-\d{2}-\d{2})T`). Damit gilt die **lokale Zeit der Anlage**; der
Zeitzonen-Offset wird nicht umgerechnet. Nur wenn der String nicht diesem
Muster entspricht, wird über `new Date()` geparst und das UTC-Datum verwendet.

## Übersprungene Dateien

Eine Datei wird mit einer Warnung im Server-Log übersprungen, wenn

- der Inhalt kein JSON-Objekt ist,
- `UserSessionInformation.UserData` fehlt,
- `MemberId` fehlt, kein String oder leer ist,
- `LastShot` oder `LastShot.TimeStamp` fehlt bzw. ungültig ist,
- kein `ParameterResults`-Eintrag mit einem `Teilers`-Array vorhanden ist.

Beispiel für eine übersprungene Datei: die Dateien im ISSF-Format in
`server/data/` (nicht `raw/`) besitzen `LastShot: null` und keine
`ParameterResults`; das Log meldet `übersprungen: LastShot fehlt`.

War die Datei zuvor erfolgreich geladen und wird später ungültig, entfernt der
Server sie aus dem Store.

## Duplikate

Zwei Dateien mit identischer `Id` gelten als derselbe Durchgang. Es zählt die
Datei mit dem lexikographisch kleineren absoluten Pfad; die andere wird
ignoriert. Wird dieselbe Datei erneut geschrieben (`change`), ersetzt sie
ihren bisherigen Eintrag.
