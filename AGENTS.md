# AGENTS.md

Scoreboard for shooting competitions ("Teiler" results). Two independent npm
packages, no shared code: `server/` (Express REST API) and `client/` (React +
Vite + Tailwind 3). README and all UI strings are German.

## Layout and install

- Root `package.json` is only a script shim: **no npm workspaces**. Each of
  `client/` and `server/` has its own `package-lock.json` and `node_modules`.
- Install: `npm run install:all` (root). `npm install` at root does nothing useful.
- Add a dependency to one package: `npm --prefix client install <pkg>` (or `server`).

## Commands (run from repo root)

- Dev: `npm run dev:server` (port 4000, `tsx watch`) and `npm run dev:client`
  (port 5173) in two terminals. Vite proxies `/api` -> `http://localhost:4000`
  (`client/vite.config.ts`). Server port comes from `PORT` env; changing it
  requires updating the proxy target too.
- Build: `npm run build:server`, `npm run build:client`.
- Typecheck only: `cd client && npx tsc -b --noEmit`;
  `cd server && npx tsc -p tsconfig.json --noEmit`.
- There are **no tests, no linter, no formatter, no CI**. `tsc` + build is the
  only verification available; run both before finishing a change.

## Toolchain gotchas

- `client` build is `tsc -b && vite build`; `noUnusedLocals` / `noUnusedParameters`
  are on, so an unused import fails the build.
- `server` is ESM (`"type": "module"`), and `tsc` does not rewrite import paths:
  relative imports must use the `.js` extension (`import ... from './data.js'`)
  even though the source file is `.ts`. Client imports are extensionless.
- Tailwind is **v3** (`tailwind.config.js` + `postcss.config.js`), not v4 syntax.

## Architecture facts not obvious from filenames

- All data is **hardcoded** in `server/src/data.ts` (in-memory `eventData`).
  `server/data/` is empty and root `schema.json` is not read by any code; it
  documents the external shooting-system export format (PascalCase keys) that
  the internal `server/src/types.ts` model does not match. Ignore README's
  claim that the server data is "based on schema.json".
- Types are duplicated: `server/src/types.ts` = internal model,
  `client/src/types.ts` = API response shapes. Changing a response in
  `server/src/index.ts` requires a manual update in `client/src/types.ts`.
- Domain rule: **lower Teiler is better**. Rankings sort ascending;
  `computeBestTeiler` returns `Number.POSITIVE_INFINITY` when there are no shots.
- `GET /api/event/all/participants` exists (aggregates all days) but is missing
  from the README API table. The client uses the string `'all'` as a sentinel
  `selectedDate` for it (`client/src/App.tsx`).
