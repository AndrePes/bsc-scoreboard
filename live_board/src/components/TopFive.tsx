import { formatTeiler } from '../format';
import type { ParticipantListEntry } from '../types';

interface TopFiveProps {
  entries: ParticipantListEntry[];
}

const SLOTS = [1, 2, 3, 4, 5];

export function TopFive({ entries }: TopFiveProps) {
  return (
    <section className="grid h-full grid-cols-5 gap-5 px-8 py-5">
      {SLOTS.map((rank) => {
        const p = entries.find((e) => e.rank === rank) ?? null;
        const isFirst = rank === 1;
        return (
          <div
            key={rank}
            className={`flex min-w-0 flex-col justify-between rounded-xl border p-5 shadow-sm ${
              isFirst
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={`flex h-12 w-12 flex-none items-center justify-center rounded-full text-2xl font-bold ${
                  isFirst
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {rank}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {isFirst ? 'Beste Summe' : `Rang ${rank}`}
              </span>
            </div>

            <div className="mt-4 min-w-0">
              <div
                className="truncate text-2xl font-semibold text-slate-800"
                title={p ? `${p.firstName} ${p.lastName}` : undefined}
              >
                {p ? `${p.firstName} ${p.lastName}` : '–'}
              </div>
              <div className="truncate text-sm text-slate-500">
                {p?.club ?? (p ? `${p.teilerCount} Teiler` : '')}
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Summe
                </div>
                <div
                  className={`text-5xl font-bold leading-none ${
                    isFirst ? 'text-emerald-700' : 'text-slate-800'
                  }`}
                >
                  {formatTeiler(p?.teilerSum)}
                </div>
              </div>
              <div className="text-right text-sm text-slate-600">
                <div>
                  Bester Teiler{' '}
                  <span className="font-semibold text-slate-800">
                    {formatTeiler(p?.bestTeiler)}
                  </span>
                </div>
                <div>
                  2. Teiler{' '}
                  <span className="font-semibold text-slate-800">
                    {formatTeiler(p?.secondBestTeiler)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
