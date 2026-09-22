import { useEffect, useState } from 'react';
import { loadLiveBoardData } from './api';
import { loadConfig, type LiveBoardConfig } from './config';
import { AutoScrollTable } from './components/AutoScrollTable';
import { Header } from './components/Header';
import { TopFive } from './components/TopFive';
import type { LiveBoardData } from './types';

const TOP_COUNT = 5;

export default function App() {
  const [config, setConfig] = useState<LiveBoardConfig | null>(null);
  const [data, setData] = useState<LiveBoardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConfig().then(setConfig);
  }, []);

  // Daten laden und im konfigurierten Intervall aktualisieren.
  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await loadLiveBoardData(config);
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void refresh();
    const timer = setInterval(
      () => void refresh(),
      config.refreshIntervalSec * 1000,
    );
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [config]);

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-2xl text-slate-500">
        Lade Konfiguration…
      </div>
    );
  }

  const ranking = data?.ranking ?? [];
  const topFive = ranking.slice(0, TOP_COUNT);
  const rest = ranking.slice(TOP_COUNT);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <Header
        eventName={data?.eventName ?? 'BSC ScoreBoard'}
        rangeName={data?.rangeName ?? ''}
        periodLabel={data?.periodLabel ?? '–'}
        loadedAt={data?.loadedAt ?? null}
        error={error}
      />

      <main className="grid min-h-0 flex-1 grid-rows-[1fr_2fr]">
        <div className="min-h-0">
          {!data && !error ? (
            <div className="flex h-full items-center justify-center text-2xl text-slate-500">
              Lade Daten…
            </div>
          ) : (
            <TopFive entries={topFive} />
          )}
        </div>
        <div className="min-h-0">
          <AutoScrollTable
            rows={rest}
            visibleRows={config.visibleRows}
            speedPxPerSec={config.scrollSpeedPxPerSec}
            pauseSec={config.scrollPauseSec}
          />
        </div>
      </main>
    </div>
  );
}
