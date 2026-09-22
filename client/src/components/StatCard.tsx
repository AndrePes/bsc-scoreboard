interface CardProps {
  label: string;
  value: string | number | null;
  /** Zusatzinfo unter dem Wert, z. B. der Name des Schützen. */
  subtitle?: string | null;
  suffix?: string;
  highlight?: boolean;
}

export function StatCard({
  label,
  value,
  subtitle,
  suffix,
  highlight,
}: CardProps) {
  const display = value === null || value === undefined ? '–' : value;
  return (
    <div
      className={`flex-1 min-w-[180px] rounded-lg border p-4 shadow-sm ${
        highlight
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-800">
        {display}
        {suffix && display !== '–' && (
          <span className="ml-1 text-sm font-normal text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 truncate text-sm text-slate-600" title={subtitle}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
