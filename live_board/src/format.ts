export function formatTeiler(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '–';
  }
  return value.toFixed(1);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
