const API = '/api';

export async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    // Database-trigger rejections (SIGNAL SQLSTATE '45000') arrive here as
    // a clean { error: "..." } body via the backend's error handler, e.g.
    // "Salary advance rejected: exceeds 3x basic salary policy cap".
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export function money(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDateTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
