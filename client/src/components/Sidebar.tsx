import type { EventDay } from '../types';

interface SidebarProps {
  eventName: string;
  rangeName: string;
  days: EventDay[];
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onSelectAll: () => void;
}

export function Sidebar({
  eventName,
  rangeName,
  days,
  selectedDate,
  onSelectDay,
  onSelectAll,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col bg-emerald-600 text-white">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-emerald-500/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            className="h-9 w-9"
            aria-hidden="true"
          >
            <circle cx="32" cy="32" r="30" fill="#059669" />
            <circle
              cx="32"
              cy="32"
              r="22"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle
              cx="32"
              cy="32"
              r="14"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle
              cx="32"
              cy="32"
              r="6"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle cx="32" cy="32" r="2" fill="#fff" />
          </svg>
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">{eventName}</div>
          <div className="text-xs text-emerald-100/90">{rangeName}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-100/80">
          Veranstaltungstage
        </div>
        <button
          type="button"
          onClick={onSelectAll}
          className={`mb-3 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition ${
            selectedDate === 'all'
              ? 'bg-white text-emerald-700 shadow'
              : 'bg-emerald-500/40 text-white hover:bg-emerald-500/60'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3.75 4.5a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75v-9.5a.75.75 0 0 0-.75-.75H3.75Z" />
            </svg>
            Gesamt (alle Tage)
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <ul className="space-y-1">
          {days.map((day) => {
            const isActive = day.date === selectedDate;
            return (
              <li key={day.date}>
                <button
                  type="button"
                  onClick={() => onSelectDay(day.date)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white text-emerald-700 shadow'
                      : 'text-emerald-50 hover:bg-emerald-500/70'
                  }`}
                >
                  <span>{day.label}</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-6 py-4 text-xs text-emerald-100/70 border-t border-emerald-500/40">
        v1.0 · BSC ScoreBoard
      </div>
    </aside>
  );
}
