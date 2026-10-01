# AGENTS.md

Scoreboard for shooting competitions ("Teiler" results). Three independent npm
packages, no shared code: `server/` (Express REST API), `client/` (React +
Vite + Tailwind 3) and `live_board/` (same stack as client; full-screen
auto-scrolling view for range monitors). README and all UI strings are German.

## Layout and install

- Root `package.json` is only a script shim: **no npm workspaces**. Each of
  `client/`, `live_board/` and `server/` has its own `package-lock.json` and
  `node_modules`.
- Install: `npm run install:all` (root). `npm install` at root does nothing useful.
- Add a dependency to one package: `npm --prefix client install <pkg>` (or
  `server` / `live_board`).

## Commands (run from repo root)

- Dev: `npm run dev:server` (port 4000, `tsx watch`), `npm run dev:client`
  (port 5173) and `npm run dev:live` (port 5174) in separate terminals. Vite
  proxies `/api` -> `http://localhost:4000` (`client/vite.config.ts`,
  `live_board/vite.config.ts`). Server port comes from `PORT` env; changing it
  requires updating both proxy targets too.
- Build: `npm run build:server`, `npm run build:client`, `npm run build:live`.
- Typecheck only: `cd client && npx tsc -b --noEmit` (same in `live_board`);
  `cd server && npx tsc -p tsconfig.json --noEmit`.
- There are **no tests, no linter, no formatter, no CI**. `tsc` + build is the
  only verification available; run both before finishing a change.

## Toolchain gotchas

- `client` and `live_board` build is `tsc -b && vite build`; `noUnusedLocals` /
  `noUnusedParameters` are on, so an unused import fails the build.
- `server` is ESM (`"type": "module"`), and `tsc` does not rewrite import paths:
  relative imports must use the `.js` extension (`import ... from './data.js'`)
  even though the source file is `.ts`. Client imports are extensionless.
- Tailwind is **v3** (`tailwind.config.js` + `postcss.config.js`), not v4 syntax.

## Architecture facts not obvious from filenames

- Server data comes from **files written by the shooting range**
  (`*_ExerciseResultData.json`, PascalCase keys, format documented in root
  `schema.json`, examples in `server/data/raw/20260904/Exercise/raw/`). The
  range creates **one folder per day**: `<dataDir>/<YYYYMMDD>/<daySubDir>`
  (`daySubDir` default `Exercise/raw`). `server/config.json` `dataDir` is the
  **root** only; `server/src/config.ts` resolves relative paths against
  `server/`, env `DATA_DIR`/`CONFIG_PATH` override.
  `server/src/watcher.ts` (chokidar) loads all day folders at startup but
  **watches only today's folder** (local date, `todayDirName()`); if it does
  not exist yet it re-checks every 5 s (chokidar 5 does not wait for missing
  paths), and it switches folders at midnight. Events add/change/unlink go
  into the in-memory `DataStore` (`server/src/store.ts`);
  `server/src/parser.ts` maps raw -> `SessionResult`.
  Only `UserData.MemberId/FirstName/Name`, `ParameterResults[].Teilers`,
  `LastShot.TimeStamp`, `Id` are used. Files missing these are skipped with a
  log warning (e.g. the ISSF-format file in `server/data/`).
- Teiler unit: raw `Teilers` are metres; the parser converts to **1/100 mm**
  (`* 100000`, 1 decimal). Days are derived from the date part of
  `LastShot.TimeStamp`; there is no fixed day list.
- Types are duplicated: `server/src/types.ts` = raw + internal model,
  `client/src/types.ts` and `live_board/src/types.ts` = API response shapes.
  Changing a response in `server/src/index.ts` requires manual updates in both.
- Domain rule: **lower Teiler is better**. Rankings sort ascending;
  `computeBestTeiler` returns `Number.POSITIVE_INFINITY` when there are no values.
  Each file contributes only its 3 best Teiler, so `teilerCount` is a count of
  Teiler values, not shots.
- Ranking order (server `compareBySum` in `index.ts`, mirrored by
  `live_board/src/api.ts:rankBySum`): `teilerSum` ascending, entries without a
  sum last, tie-break by `bestTeiler`. "All days" uses the **day-best rule**
  (`pickBestTwo`): with >= 2 days, best and second are the two smallest
  per-day bests (different days); with 1 day, best and second shot of that day.
  List entries carry `bestTeilerDate` / `secondBestTeilerDate`.
- `GET /api/event/all/participants` aggregates all days. The client uses the
  string `'all'` as a sentinel `selectedDate` for it (`client/src/App.tsx`).
- Client server address is runtime config: `client/public/config.json`
  (`apiBaseUrl`), loaded by `client/src/config.ts`; empty = same origin/Vite proxy.
  `live_board/public/config.json` does the same plus `dates` (`[]` = all days;
  several dates are merged client-side in `live_board/src/api.ts:mergeRankings`,
  which only works because each list entry carries best + second-best Teiler),
  `refreshIntervalSec`, `scrollSpeedPxPerSec`, `scrollPauseSec`, `visibleRows`.
  Live-board ranking is re-sorted client-side by `teilerSum` ascending
  (`rankBySum`; same order as the server). Top 5 of the ranking are tiles, ranks >= 6 go to the auto-scrolling table
  (`live_board/src/components/AutoScrollTable.tsx`, rAF + translateY, row height
  = viewport / visibleRows).
- chokidar 5 requires Node >= 20.19.
