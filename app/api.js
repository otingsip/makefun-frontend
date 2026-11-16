const origin = 'https://make.fun/api';
const responses = new Map();
const escapeSegment = encodeURIComponent;

async function request(resource) {
  const address = origin + resource;
  const saved = responses.get(address);
  const plain = () => fetch(address);
  let reply;
  if (!saved) reply = await plain();
  else {
    try {
      reply = await fetch(address, { headers: { 'If-None-Match': saved.tag } });
    } catch {
      reply = await plain();
    }
  }
  const finalURL = reply.url || address;
  if (reply.status === 304 && saved) return { body: saved.body, finalURL };
  if (!reply.ok) {
    const failure = new Error(`make.fun API ${reply.status} for ${resource}`);
    failure.status = reply.status;
    throw failure;
  }
  const body = await reply.json();
  const tag = reply.headers.get('ETag');
  if (tag) responses.set(address, { tag, body });
  return { body, finalURL };
}

export async function getProfile(handle) {
  const { body, finalURL } = await request(`/profiles/${escapeSegment(handle)}`);
  let current = handle;
  try {
    const segments = new URL(finalURL).pathname.match(/\/profiles\/([^/]+)$/);
    if (segments) current = decodeURIComponent(segments[1]);
  } catch { /* Keep the requested handle if the response URL is unusable. */ }
  return { profile: body, current };
}

export async function getLeaderboard(slug, view) {
  let resource = `/competitions/${escapeSegment(slug)}/leaderboard?rows=first`;
  if (view) resource += `&view=${escapeSegment(view)}`;
  return (await request(resource)).body;
}

export async function getBounty(slug) {
  return (await request(`/competitions/${escapeSegment(slug)}?submissions=summary`)).body;
}

export async function getBounties() {
  return (await request('/competitions?status=open&activity=times')).body;
}
