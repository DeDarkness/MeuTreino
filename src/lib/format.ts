export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
  if (minutes > 0) return `${minutes} min`;
  return `${safe} s`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDate(value: string, withTime = false): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function todayLabel(): string {
  const value = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatWeight(value: number | null, unit: 'kg' | 'lb'): string {
  if (value === null) return '—';
  const converted = unit === 'lb' ? value * 2.2046226218 : value;
  return `${Number.isInteger(converted) ? converted : converted.toFixed(1)} ${unit}`;
}

export function toStoredWeight(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? value / 2.2046226218 : value;
}

export function fromStoredWeight(value: number | null, unit: 'kg' | 'lb'): number | null {
  if (value === null) return null;
  const converted = unit === 'lb' ? value * 2.2046226218 : value;
  return Math.round(converted * 10) / 10;
}
