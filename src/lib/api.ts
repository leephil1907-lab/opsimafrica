export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this request.');
  return data;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export function exportReport(days: number) {
  const a = document.createElement('a');
  a.href = `/api/export/sessions.csv?days=${days}`;
  a.download = 'OpsSim-training-report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
