const API_ROOT = 'https://make.fun/api';
const cache = new Map();
const enc = value => encodeURIComponent(value);

async function read(path) {
  const url = API_ROOT + path;
  const old = cache.get(url);
  let response;
  if (old) {
    try { response = await fetch(url, { headers: { 'If-None-Match': old.etag } }); }
    catch { response = await fetch(url); }
  } else response = await fetch(url);
  if (old && response.status === 304) return { value: old.value, url: response.url || url };
  if (!response.ok) throw Object.assign(new Error(`make.fun API ${response.status} for ${path}`), { status: response.status });
  const value = await response.json();
  const etag = response.headers.get('ETag');
  if (etag) cache.set(url, { etag, value });
  return { value, url: response.url || url };
}

export async function getBounties() { return (await read('/competitions?status=open&activity=times')).value; }
export async function getBounty(slug) { return (await read('/competitions/' + enc(slug) + '?submissions=summary')).value; }
export async function getLeaderboard(slug, view) {
  const path = '/competitions/' + enc(slug) + '/leaderboard?rows=first' + (view ? '&view=' + enc(view) : '');
  return (await read(path)).value;
}
export async function getProfile(handle) {
  const result = await read('/profiles/' + enc(handle));
  let current = handle;
  try { const match = new URL(result.url).pathname.match(/\/profiles\/([^/]+)$/); if (match) current = decodeURIComponent(match[1]); } catch {}
  return { profile: result.value, current };
}
