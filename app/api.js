// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every answer is cached in memory and revalidated with its ETag: the API's
// ETags are bound to the minute, so an If-None-Match inside the same minute
// answers 304 and we reuse the cached body instead of downloading it again.

const API = 'https://make.fun/api';
const cache = new Map();

/** One GET, revalidated with the cached ETag when we have one. Returns { data, url }. */
async function get(path) {
  const url = API + path;
  const hit = cache.get(url);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    // A revalidation that fails (e.g. a preflight) is retried plain once.
    if (hit && hit.etag) res = await fetch(url);
    else throw err;
  }
  if (res.status === 304 && hit) return { data: hit.data, url: res.url || url };
  if (!res.ok) {
    const err = new Error(`make.fun API ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) cache.set(url, { etag, data });
  return { data, url: res.url || url };
}

/** The open bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export async function getBounties() {
  return (await get('/competitions?status=open&activity=times')).data;
}

/** One bounty, by its slug, with its live payout table (rewardsNow). */
export async function getBounty(slug) {
  return (await get(`/competitions/${encodeURIComponent(slug)}?submissions=summary`)).data;
}

/** A bounty's leaderboard: GET /api/competitions/{slug}/leaderboard.
 *  ?rows=first keeps the payload small: the first 10 rows whole, the rest as
 *  stubs. view is 'performance' (default) or 'overall' where the board offers it. */
export async function getLeaderboard(slug, view) {
  const q = view ? `?rows=first&view=${encodeURIComponent(view)}` : '?rows=first';
  return (await get(`/competitions/${encodeURIComponent(slug)}/leaderboard${q}`)).data;
}

/** An account's public profile: GET /api/profiles/{handle}.
 *  A handle moved in the last 90 days answers 308; fetch follows it, so the
 *  returned url tells us the current handle when it changed. */
export async function getProfile(handle) {
  const res = await get(`/profiles/${encodeURIComponent(handle)}`);
  let current = handle;
  try {
    const u = new URL(res.url);
    const m = u.pathname.match(/\/profiles\/(.+)$/);
    if (m) current = decodeURIComponent(m[1]);
  } catch {
    // Keep the requested handle when the final URL cannot be read.
  }
  return { profile: res.data, current };
}
