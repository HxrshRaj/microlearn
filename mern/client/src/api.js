// Tiny fetch wrapper. The access token lives in memory only; the refresh token is an
// httpOnly cookie the browser sends automatically, so a page reload silently re-authenticates.
const BASE = import.meta.env.VITE_API_URL || '';
let accessToken = null;
let onAuthLost = () => {};

export const setAccessToken = (t) => { accessToken = t; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

async function raw(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function refreshSession() {
  const { res, data } = await raw('/auth/refresh', { method: 'POST', auth: false });
  if (!res.ok) return null;
  accessToken = data.accessToken;
  return data.user;
}

export async function api(path, opts) {
  let { res, data } = await raw(path, opts);
  if (res.status === 401 && opts?.auth !== false && !path.startsWith('/auth/')) {
    const user = await refreshSession(); // access token expired: rotate once and retry
    if (!user) { onAuthLost(); throw new Error('Session expired. Please sign in again.'); }
    ({ res, data } = await raw(path, opts));
  }
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
