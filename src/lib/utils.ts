import type { Session } from '../types';
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
export function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function humanDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
export function dateLabel(value: string, short = false) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(!short ? { year: 'numeric' } : {}),
  });
}
export function relative(value: string) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 1440)}d ago`;
}
export function completedIn(sessions: Session[], days: number) {
  return sessions.filter(
    (s) => s.status === 'completed' && Date.parse(s.startedAt) >= Date.now() - days * 86400000,
  );
}
export function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
export function metrics(sessions: Session[]) {
  return {
    count: sessions.length,
    score: Math.round(avg(sessions.map((s) => s.score || 0))),
    accuracy: Math.round(avg(sessions.map((s) => s.accuracy || 0))),
    time: Math.round(avg(sessions.map((s) => s.elapsedSeconds))),
    errors: avg(sessions.map((s) => s.errors)),
  };
}
export function compare(sessions: Session[]) {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const half = Math.ceil(sorted.length / 2);
  return { before: metrics(sorted.slice(0, half)), after: metrics(sorted.slice(half)) };
}
export function scoreClass(score: number) {
  return score >= 85 ? 'excellent' : score >= 65 ? 'good' : 'needs-work';
}
export function soundFeedback(correct: boolean) {
  try {
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.value = correct ? 660 : 220;
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    osc.start();
    osc.stop(audio.currentTime + 0.15);
    osc.onended = () => void audio.close();
  } catch {
    /* Audio is optional. */
  }
}
