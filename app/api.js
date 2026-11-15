const origin = 'https://make.fun/api';
const responses = new Map();
const segment = value => encodeURIComponent(value);

async function request(resource) {
  const address = origin + resource;
  const saved = responses.get(address);
  let response;
  if (!saved?.tag) {
    response = await fetch(address, { headers: {} });
  } else {
    try {
      response = await fetch(address, { headers: { 'If-None-Match': saved.tag } });
    } catch {
      response = await fetch(address);
    }
  }
  const finalURL = response.url || address;
  if (saved && response.status === 304) return [saved.body, finalURL];
  if (!response.ok) {
    throw Object.assign(new Error(`make.fun API ${response.status} for ${resource}`), { status: response.status });
  }
  const body = await response.json();
  const tag = response.headers.get('ETag');
  if (tag) responses.set(address, { body, tag });
  return [body, finalURL];
}

export async function getProfile(handle) {
  const [profile, finalURL] = await request('/profiles/' + segment(handle));
  let current = handle;
  try {
    const suffix = new URL(finalURL).pathname.match(/\/profiles\/(.+)$/);
    if (suffix) current = decodeURIComponent(suffix[1]);
  } catch {}
  return { profile, current };
}

export async function getLeaderboard(slug, view) {
  const suffix = view ? '&view=' + segment(view) : '';
  const [body] = await request('/competitions/' + segment(slug) + '/leaderboard?rows=first' + suffix);
  return body;
}

export async function getBounty(slug) {
  const [body] = await request('/competitions/' + segment(slug) + '?submissions=summary');
  return body;
}

export async function getBounties() {
  const [body] = await request('/competitions?status=open&activity=times');
  return body;
}
