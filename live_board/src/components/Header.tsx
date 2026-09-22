import { formatTime } from '../format';

interface HeaderProps {
  eventName: string;
  rangeName: string;
  periodLabel: string;
  loadedAt: Date | null;
  error: string | null;
}

export function Header({
  eventName,
  rangeName,
  periodLabel,
  loadedAt,
  error,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-5 bg-emerald-600 px-8 py-3 text-white shadow-md">
      <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-white/15">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          className="h-11 w-11"
          aria-hidden="true"
        >
          <circle cx="32" cy="32" r="30" fill="#059669" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="32" cy="32" r="6" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="32" cy="32" r="2" fill="#fff" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-3xl font-bold leading-tight">
          {eventName}
        </div>
        <div className="truncate text-base text-emerald-100/90">
          {rangeName} · {periodLabel}
        </div>
      </div>
      <div className="text-right text-sm text-emerald-100/90">
        {error ? (
          <span className="rounded-md bg-red-600 px-3 py-1 font-medium text-white">
            Verbindungsfehler: {error}
          </span>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider">Letzte Aktualisierung</div>
            <div className="text-lg font-semibold text-white">
              {loadedAt ? formatTime(loadedAt) : '–'}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
