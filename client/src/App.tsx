import { useEffect, useState } from 'react';
import { api } from './api';
import type { EventInfo } from './types';
import { Sidebar } from './components/Sidebar';
import { CenterColumn } from './components/CenterColumn';
import { DetailsColumn } from './components/DetailsColumn';

export default function App() {
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getEvent()
      .then((info) => {
        if (cancelled) return;
        setEventInfo(info);
        if (info.days.length > 0) {
          setSelectedDate(info.days[0].date);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-red-600">
        Fehler beim Laden der Veranstaltung: {loadError}
      </div>
    );
  }

  if (!eventInfo) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Lade Veranstaltung…
      </div>
    );
  }

  const selectedDay =
    selectedDate === 'all'
      ? null
      : eventInfo.days.find((d) => d.date === selectedDate) ?? null;

  return (
    <div className="grid h-full w-full grid-cols-[280px_minmax(0,1fr)_minmax(320px,420px)]">
      <Sidebar
        eventName={eventInfo.eventName}
        rangeName={eventInfo.rangeName}
        days={eventInfo.days}
        selectedDate={selectedDate}
        onSelectAll={() => {
          setSelectedDate('all');
          setSelectedParticipantId(null);
        }}
        onSelectDay={(date) => {
          setSelectedDate(date);
          setSelectedParticipantId(null);
        }}
      />
      <CenterColumn
        eventName={eventInfo.eventName}
        selectedDate={selectedDate}
        selectedParticipantId={selectedParticipantId}
        onSelectParticipant={setSelectedParticipantId}
      />
      <DetailsColumn
        participantId={selectedParticipantId}
        selectedDate={selectedDate}
        dayLabel={selectedDay?.label ?? null}
      />
    </div>
  );
}
