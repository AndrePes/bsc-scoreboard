import { useEffect, useRef, useState } from 'react';
import { formatTeiler } from '../format';
import type { ParticipantListEntry } from '../types';

interface AutoScrollTableProps {
  rows: ParticipantListEntry[];
  /** Anzahl gleichzeitig sichtbarer Zeilen. */
  visibleRows: number;
  /** Scrollgeschwindigkeit in Pixel pro Sekunde. */
  speedPxPerSec: number;
  /** Pause am Anfang und Ende in Sekunden. */
  pauseSec: number;
}

const GRID_COLS =
  'grid-cols-[5rem_minmax(0,1fr)_10rem_10rem_10rem_7rem]';

type Phase = 'pauseTop' | 'scrolling' | 'pauseBottom';

export function AutoScrollTable({
  rows,
  visibleRows,
  speedPxPerSec,
  pauseSec,
}: AutoScrollTableProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [rowHeight, setRowHeight] = useState(0);

  // Zeilenhöhe so wählen, dass genau `visibleRows` Zeilen in den Viewport passen.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () =>
      setRowHeight(Math.floor(viewport.clientHeight / visibleRows));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [visibleRows]);

  // Endlos-Scroll: Pause oben -> langsam nach unten -> Pause unten -> Sprung nach oben.
  useEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list || rowHeight === 0) return;

    let offset = 0;
    let phase: Phase = 'pauseTop';
    let phaseStart = performance.now();
    let last = phaseStart;
    let frame = 0;
    const pauseMs = pauseSec * 1000;

    const apply = () => {
      list.style.transform = `translateY(${-offset}px)`;
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const maxOffset = Math.max(0, list.scrollHeight - viewport.clientHeight);

      if (maxOffset === 0) {
        // Alles passt in den Viewport: nichts scrollen.
        offset = 0;
        phase = 'pauseTop';
        phaseStart = now;
      } else if (phase === 'pauseTop') {
        if (now - phaseStart >= pauseMs) {
          phase = 'scrolling';
        }
      } else if (phase === 'scrolling') {
        offset = Math.min(maxOffset, offset + speedPxPerSec * dt);
        if (offset >= maxOffset) {
          phase = 'pauseBottom';
          phaseStart = now;
        }
      } else if (now - phaseStart >= pauseMs) {
        offset = 0;
        phase = 'pauseTop';
        phaseStart = now;
      }

      apply();
      frame = requestAnimationFrame(tick);
    };

    apply();
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rowHeight, speedPxPerSec, pauseSec, rows.length]);

  return (
    <section className="flex h-full min-h-0 flex-col px-8 pb-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          className={`grid ${GRID_COLS} flex-none items-center gap-6 border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-slate-500`}
        >
          <span>Rang</span>
          <span>Name / Verein</span>
          <span className="text-right">Bester Teiler</span>
          <span className="text-right">2. Teiler</span>
          <span className="text-right">Summe</span>
          <span className="text-right">Anzahl</span>
        </div>

        <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-2xl text-slate-400">
              Keine weiteren Teilnehmer
            </div>
          ) : (
            <ul
              ref={listRef}
              className="divide-y divide-slate-200 will-change-transform"
            >
              {rows.map((p) => (
                <li
                  key={p.id}
                  style={{ height: rowHeight || undefined }}
                  className={`grid ${GRID_COLS} items-center gap-6 px-6`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-700">
                    {p.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-3xl font-semibold text-slate-800">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="block truncate text-base text-slate-500">
                      {p.club ?? '–'}
                    </span>
                  </span>
                  <span className="text-right text-3xl font-semibold text-slate-800">
                    {formatTeiler(p.bestTeiler)}
                  </span>
                  <span className="text-right text-3xl text-slate-700">
                    {formatTeiler(p.secondBestTeiler)}
                  </span>
                  <span className="text-right text-3xl font-semibold text-emerald-700">
                    {formatTeiler(p.teilerSum)}
                  </span>
                  <span className="text-right text-2xl text-slate-600">
                    {p.teilerCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
