import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import * as views from './views.js';
import { hasEnded, money } from './format.js';

const PAGE = 25;
const SOL_PAGE = 10;
const element = id => document.getElementById(id);
const root = element('app');
const state = { q: '', cat: 'all', sort: 'deadline', st: 'all' };
let inventory = [];
let routeVersion = 0;
const timestamp = value => new Date(value).getTime();
const prize = bounty => Number(bounty.potUsd ?? bounty.rewardAmount ?? 0) || 0;

const ordering = {
  title: (left, right) => String(left.title).localeCompare(String(right.title)),
  newest: (left, right) => timestamp(right.publishedAt || right.deadline) - timestamp(left.publishedAt || left.deadline),
  entries: (left, right) => (right.submissionCount || 0) - (left.submissionCount || 0),
  pot: (left, right) => prize(right) - prize(left),
  deadline: (left, right) => Number(hasEnded(left.deadline)) - Number(hasEnded(right.deadline)) || timestamp(left.deadline) - timestamp(right.deadline),
};

function matches(bounty) {
  if (state.cat !== 'all' && state.cat !== bounty.category) return false;
  const search = state.q.trim().toLowerCase();
  const words = [bounty.title, bounty.slug, bounty.category, ...(bounty.skills || [])];
  if (search && !words.filter(Boolean).join(' ').toLowerCase().includes(search)) return false;
  const closed = hasEnded(bounty.deadline);
  switch (state.st) {
    case 'all': return true;
    case 'ended': return closed;
    case 'open': return !closed;
    case 'soon': return !closed && timestamp(bounty.deadline) - Date.now() <= 48 * 60 * 60 * 1000;
    default: return false;
  }
}

function updateBoard() {
  const visible = inventory.filter(matches).sort(ordering[state.sort] || ordering.deadline);
  element('board-count').textContent = `${visible.length} of ${inventory.length} bounties · ${money(visible.reduce((total, bounty) => total + prize(bounty), 0))} total live pot`;
  element('board-list').innerHTML = visible.length
    ? visible.map(views.boardRow).join('')
    : '<li>No bounties match these filters.</li>';
}

function mountBoard(payload) {
  inventory = payload.items || [];
  const categories = Array.from(new Set(inventory.map(bounty => bounty.category).filter(Boolean))).sort();
  root.innerHTML = views.boardShell(categories);
  for (const key of ['q', 'cat', 'sort']) {
    const control = element(key);
    control.value = state[key];
    if (key === 'cat' && !control.value) state.cat = control.value = 'all';
    control.addEventListener(key === 'q' ? 'input' : 'change', () => {
      state[key] = control.value;
      updateBoard();
    });
  }
  const radio = document.querySelector(`input[name="st"][value="${state.st}"]`);
  if (radio) radio.checked = true;
  element('board-controls').addEventListener('submit', event => event.preventDefault());
  element('status-chips').addEventListener('change', event => {
    state.st = event.target.value;
    updateBoard();
  });
  updateBoard();
}

function attachPagination(prefix, records, step, rowHTML, noun) {
  const button = element(prefix + '-more');
  if (!button) return;
  let offset = Math.min(step, records.length);
  button.addEventListener('click', () => {
    const batch = records.slice(offset, offset + step);
    element(prefix + '-body').insertAdjacentHTML('beforeend', batch.map(rowHTML).join(''));
    offset += batch.length;
    const counter = element(prefix + '-count');
    if (counter) counter.textContent = `${offset} of ${records.length} ${noun} shown.`;
    if (offset >= records.length) button.remove();
  });
}

const surfaces = {
  board: {
    fetch: () => getBounties(),
    show(data) { document.title = 'make.fun bounties'; mountBoard(data); },
  },
  bounty: {
    fetch: route => getBounty(route.name),
    show(data) {
      document.title = `${data.title} | make.fun bounties`;
      root.innerHTML = views.bounty(data);
    },
  },
  leaderboard: {
    fetch: route => getLeaderboard(route.name, route.view),
    show(data, route) {
      document.title = `Leaderboard: ${data.competition?.title || route.name} | make.fun bounties`;
      root.innerHTML = views.leaderboard(route.name, data);
      const columns = (data.columns || []).filter(column => !column.hidden).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      attachPagination('lb', (data.entries || []).concat(data.rest || []), PAGE, entry => views.lbRow(entry, columns), 'rows');
    },
  },
  profile: {
    fetch: route => getProfile(route.name),
    show(data, route) {
      document.title = `@${data.current} | make.fun bounties`;
      root.innerHTML = views.profile(data.current, data.profile, route.name);
      attachPagination('sol', data.profile.solutions || [], SOL_PAGE, views.solutionRow, 'entries');
    },
  },
  missing: {
    fetch: () => null,
    show() {
      document.title = 'Not found | make.fun bounties';
      root.innerHTML = views.notFoundView('That route does not exist.');
    },
  },
};

function resolveHash() {
  const [path, query = ''] = location.hash.substring(1).split('?');
  if (path === '/' || !path) return { type: 'board' };
  const parts = /^\/(bounty|profile|u|account)\/([^/]+)(\/leaderboard)?$/.exec(path);
  if (!parts || (parts[3] && parts[1] !== 'bounty')) return { type: 'missing' };
  try {
    const type = parts[3] ? 'leaderboard' : parts[1] === 'bounty' ? 'bounty' : 'profile';
    return { type, name: decodeURIComponent(parts[2]), view: new URLSearchParams(query).get('view') };
  } catch { return { type: 'missing' }; }
}

function showFailure(error) {
  const missing = error?.status === 404;
  document.title = `${missing ? 'Not found' : 'Error'} | make.fun bounties`;
  root.innerHTML = missing
    ? views.notFoundView('That bounty, leaderboard or profile does not exist, or it is not public.')
    : views.errorView(error?.message || 'Could not load data from make.fun. Check your connection and try again.');
}

async function waitForImages() {
  const unfinished = Array.from(document.images).filter(image => !image.complete);
  if (!unfinished.length) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 5000);
    let remaining = unfinished.length;
    const settled = () => {
      remaining -= 1;
      if (!remaining) { clearTimeout(timer); resolve(); }
    };
    for (const image of unfinished) {
      image.addEventListener('load', settled, { once: true });
      image.addEventListener('error', settled, { once: true });
    }
  });
}

async function navigate() {
  const ticket = ++routeVersion;
  window.__shotReady = false;
  root.innerHTML = '<p>Loading…</p>';
  const route = resolveHash();
  const surface = surfaces[route.type];
  try {
    const payload = await surface.fetch(route);
    if (ticket !== routeVersion) return;
    surface.show(payload, route);
  } catch (error) {
    if (ticket !== routeVersion) return;
    showFailure(error);
  }
  if (ticket !== routeVersion) return;
  window.scrollTo(0, 0);
  await waitForImages();
  if (ticket === routeVersion) window.__shotReady = true;
}

window.addEventListener('hashchange', navigate);
navigate();
