import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ParticipantDetail } from '../types';

interface DetailsColumnProps {
  participantId: string | null;
  selectedDate: string | null;
  dayLabel: string | null;
}

function fmt(value: number | null): string {
  if (value === null || value === undefined) return '–';
  return value.toFixed(1);
}

interface Row {
  label: string;
  value: string;
}

function DescriptionList({ rows }: { rows: Row[] }) {
  return (
    <dl className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {rows.map((row, idx) => (
        <div
          key={row.label}
          className={`flex items-baseline justify-between gap-4 px-4 py-3 text-sm ${
            idx !== rows.length - 1 ? 'border-b border-slate-100' : ''
          }`}
        >
          <dt className="text-slate-500">{row.label}</dt>
          <dd className="text-right font-medium text-slate-800">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailsColumn({
  participantId,
  selectedDate,
  dayLabel,
}: DetailsColumnProps) {
  const [data, setData] = useState<ParticipantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!participantId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const dateParam =
      selectedDate && selectedDate !== 'all' ? selectedDate : undefined;
    api
      .getParticipant(participantId, dateParam)
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
  }, [participantId, selectedDate]);

  return (
    <section className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-800">
          Teilnehmerdetails
        </h2>
        <p className="text-sm text-slate-500">
          {dayLabel
            ? `Angaben für ${dayLabel} und alle Tage`
            : 'Angaben für alle Tage'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!participantId && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Bitte einen Teilnehmer aus der Rangliste auswählen, um Details
            anzuzeigen.
          </div>
        )}

        {participantId && loading && (
          <div className="text-sm text-slate-500">Lade Details…</div>
        )}

        {participantId && error && (
          <div className="text-sm text-red-600">Fehler: {error}</div>
        )}

        {participantId && data && (
          <DescriptionList
            rows={[
              {
                label: 'Vorname, Nachname',
                value: `${data.firstName} ${data.lastName}`,
              },
              { label: 'ID', value: data.id },
              {
                label: 'Bester Schuss/Teiler (Ausgewählter Tag)',
                value: fmt(data.selectedDayStats.bestTeiler),
              },
              {
                label: 'Schlechtester Schuss/Teiler (Ausgewählter Tag)',
                value: fmt(data.selectedDayStats.worstTeiler),
              },
              {
                label: 'Anzahl abgegebener Schüsse (Ausgewählter Tag)',
                value: String(data.selectedDayStats.shotCount),
              },
              {
                label: 'Bester Schuss/Teiler (Alle Tage)',
                value: fmt(data.allDaysStats.bestTeiler),
              },
              {
                label: 'Schlechtester Schuss/Teiler (Alle Tage)',
                value: fmt(data.allDaysStats.worstTeiler),
              },
              {
                label: 'Anzahl abgegebener Schüsse (Alle Tage)',
                value: String(data.allDaysStats.shotCount),
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}
