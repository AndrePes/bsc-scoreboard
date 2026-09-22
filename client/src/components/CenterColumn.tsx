import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DayParticipantsResponse, TopTeiler } from '../types';
import { StatCard } from './StatCard';

interface CenterColumnProps {
  eventName?: string;
  selectedDate: string | null;
  selectedParticipantId: string | null;
  onSelectParticipant: (id: string) => void;
}

function formatTeiler(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return value.toFixed(1);
}

function topName(top: TopTeiler | null | undefined): string | null {
  if (!top) return null;
  return `${top.firstName} ${top.lastName}`;
}

export function CenterColumn({
  eventName,
  selectedDate,
  selectedParticipantId,
  onSelectParticipant,
}: CenterColumnProps) {
  const [data, setData] = useState<DayParticipantsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    if (!data) return;
    setExporting(true);
    try {
      // PDF-Bibliothek erst bei Bedarf laden (hält das Hauptbundle klein).
      const { exportRanglistePdf } = await import('../pdfExport');
      exportRanglistePdf(data, eventName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'PDF-Export fehlgeschlagen',
      );
    } finally {
      setExporting(false);
    }
  }

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

  const canExport =
    !!data && data.participants.length > 0 && !loading && !exporting;

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
            label="Bester Teiler"
            value={formatTeiler(data?.stats.bestTeiler?.teiler)}
            subtitle={topName(data?.stats.bestTeiler)}
            highlight
          />
          <StatCard
            label="Zweitbester Teiler"
            value={formatTeiler(data?.stats.secondBestTeiler?.teiler)}
            subtitle={topName(data?.stats.secondBestTeiler)}
          />
          <StatCard
            label="Drittbester Teiler"
            value={formatTeiler(data?.stats.thirdBestTeiler?.teiler)}
            subtitle={topName(data?.stats.thirdBestTeiler)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Rangliste
          </h3>
          <button
            type="button"
            disabled={!canExport}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white"
            title="Rangliste als PDF exportieren"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            {exporting ? 'Exportiere…' : 'Als PDF exportieren'}
          </button>
        </div>
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
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_repeat(3,5.5rem)] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span>#</span>
              <span>Name / Verein</span>
              <span className="text-right">Bester</span>
              <span className="text-right">2. Teiler</span>
              <span className="text-right">Summe</span>
            </div>
            <ul className="divide-y divide-slate-200">
              {data.participants.map((p) => {
                const isActive = p.id === selectedParticipantId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelectParticipant(p.id)}
                      className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_repeat(3,5.5rem)] items-center gap-4 px-4 py-3 text-left transition ${
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
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {p.club ?? '–'} · {p.teilerCount} Teiler
                        </span>
                      </span>
                      <span className="text-right text-sm font-semibold text-slate-800">
                        {formatTeiler(p.bestTeiler)}
                      </span>
                      <span className="text-right text-sm text-slate-700">
                        {formatTeiler(p.secondBestTeiler)}
                      </span>
                      <span className="text-right text-sm font-semibold text-emerald-700">
                        {formatTeiler(p.teilerSum)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
