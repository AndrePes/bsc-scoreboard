import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DayParticipantsResponse } from '../types';
import { StatCard } from './StatCard';

interface CenterColumnProps {
  selectedDate: string | null;
  selectedParticipantId: string | null;
  onSelectParticipant: (id: string) => void;
}

function formatTeiler(value: number | null): string {
  if (value === null || value === undefined) return '–';
  return value.toFixed(1);
}

export function CenterColumn({
  selectedDate,
  selectedParticipantId,
  onSelectParticipant,
}: CenterColumnProps) {
  const [data, setData] = useState<DayParticipantsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request =
      selectedDate === 'all'
        ? api.getAllDaysParticipants()
        : api.getDayParticipants(selectedDate);
    request
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  if (!selectedDate) {
    return (
      <section className="flex h-full items-center justify-center bg-slate-50 p-6 text-slate-500">
        Bitte einen Tag in der Sidebar auswählen.
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-800">
          {data?.day.label ?? '–'}
        </h2>
        <p className="text-sm text-slate-500">
          Tagesstatistik und Rangliste
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          <StatCard
            label="Teilnehmer"
            value={data?.stats.participantCount ?? null}
            highlight
          />
          <StatCard
            label="Bester Teiler"
            value={formatTeiler(data?.stats.bestTeiler ?? null)}
          />
          <StatCard
            label="Zweitbester Teiler"
            value={formatTeiler(data?.stats.secondBestTeiler ?? null)}
          />
          <StatCard
            label="Drittbester Teiler"
            value={formatTeiler(data?.stats.thirdBestTeiler ?? null)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Rangliste
        </h3>
        {loading && (
          <div className="text-sm text-slate-500">Lade Teilnehmer…</div>
        )}
        {error && (
          <div className="text-sm text-red-600">Fehler: {error}</div>
        )}
        {data && data.participants.length === 0 && (
          <div className="text-sm text-slate-500">
            Keine Teilnehmer an diesem Tag.
          </div>
        )}
        {data && data.participants.length > 0 && (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {data.participants.map((p) => {
              const isActive = p.id === selectedParticipantId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectParticipant(p.id)}
                    className={`flex w-full items-center gap-4 px-4 py-3 text-left transition ${
                      isActive
                        ? 'bg-emerald-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.rank}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-800">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {p.club ?? '–'}
                      </span>
                    </span>
                    <span className="text-right text-sm">
                      <span className="block font-semibold text-slate-800">
                        {p.bestTeiler.toFixed(1)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {p.totalShots} Schüsse
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
