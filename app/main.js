import * as api from './api.js';
import * as view from './views.js';
import { money, hasEnded } from './format.js';

const root = document.getElementById('app');
const PAGE = 25, SOL_PAGE = 10;
const boardState = { q: '', cat: 'all', sort: 'deadline', st: 'all' };
let inventory = [];
let routeVersion = 0;
const element = id => document.getElementById(id);
const pot = item => Number(item.potUsd ?? item.rewardAmount ?? 0) || 0;
const timestamp = value => new Date(value).getTime();

function updateBoard() {
  const needle = boardState.q.trim().toLowerCase();
  const selected = inventory.filter(item => {
    const { cat, st } = boardState;
    const closed = hasEnded(item.deadline);
    const text = [item.title || '', item.slug || '', item.category || '', ...(item.skills || [])].join(' ').toLowerCase();
    return (cat === 'all' || cat === item.category)
      && (!needle || text.includes(needle))
      && (st !== 'ended' || closed)
      && (st !== 'open' || !closed)
      && (st !== 'soon' || (!closed && !(timestamp(item.deadline) - Date.now() > 172800000)));
  });
  const comparators = {
    title: (a, b) => String(a.title).localeCompare(String(b.title)),
    newest: (a, b) => timestamp(b.publishedAt || b.deadline) - timestamp(a.publishedAt || a.deadline),
    entries: (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0),
    pot: (a, b) => pot(b) - pot(a),
    deadline: (a, b) => Number(hasEnded(a.deadline)) - Number(hasEnded(b.deadline)) || timestamp(a.deadline) - timestamp(b.deadline),
  };
  if (comparators[boardState.sort]) selected.sort(comparators[boardState.sort]);
  element('board-list').innerHTML = selected.length ? selected.map(view.boardRow).join('') : '<li>No bounties match these filters.</li>';
  element('board-count').textContent = `${selected.length} of ${inventory.length} bounties · ${money(selected.reduce((total, item) => total + pot(item), 0))} total live pot`;
}

function connectBoard(data) {
  inventory = data.items || [];
  root.innerHTML = view.boardShell(Array.from(new Set(inventory.map(item => item.category).filter(Boolean))).sort());
  for (const key of ['q', 'cat', 'sort']) {
    const input = element(key);
    input.value = boardState[key];
    if (key === 'cat' && input.value !== boardState.cat) input.value = boardState.cat = 'all';
    input.addEventListener(key === 'q' ? 'input' : 'change', () => {
      boardState[key] = input.value;
      updateBoard();
    });
  }
  document.querySelector(`input[name="st"][value="${boardState.st}"]`).checked = true;
  element('status-chips').addEventListener('change', event => {
    boardState.st = event.target.value;
    updateBoard();
  });
  element('board-controls').addEventListener('submit', event => event.preventDefault());
  updateBoard();
}

function connectPages(prefix, records, size, draw, noun) {
  const button = element(prefix + '-more');
  if (!button) return;
  let offset = Math.min(size, records.length);
  button.addEventListener('click', () => {
    const batch = records.slice(offset, offset + size);
    element(prefix + '-body').insertAdjacentHTML('beforeend', batch.map(draw).join(''));
    offset += batch.length;
    const count = element(prefix + '-count');
    if (count) count.textContent = `${offset} of ${records.length} ${noun} shown.`;
    if (offset === records.length) button.remove();
  });
}

function resolveRoute() {
  const [path, search] = location.hash.replace(/^#/, '').split('?');
  if (!path || path === '/') return { kind: 'board' };
  const parts = path.match(/^\/(bounty|profile|u|account)\/([^/]+)(\/leaderboard)?$/);
  if (!parts || (parts[3] && parts[1] !== 'bounty')) return { kind: 'missing' };
  return {
    kind: parts[1] === 'bounty' ? (parts[3] ? 'leaderboard' : 'bounty') : 'profile',
    name: decodeURIComponent(parts[2]),
    mode: new URLSearchParams(search || '').get('view'),
  };
}

async function loadRoute(route) {
  switch (route.kind) {
    case 'board': return api.getBounties();
    case 'bounty': return api.getBounty(route.name);
    case 'profile': return api.getProfile(route.name);
    case 'leaderboard': return api.getLeaderboard(route.name, route.mode);
  }
}

function display(route, data) {
  let title;
  switch (route.kind) {
    case 'board':
      title = 'make.fun bounties';
      connectBoard(data);
      break;
    case 'bounty':
      title = `${data.title} | make.fun bounties`;
      root.innerHTML = view.bounty(data);
      break;
    case 'profile': {
      title = `@${data.current} | make.fun bounties`;
      root.innerHTML = view.profile(data.current, data.profile, route.name);
      const solutions = Array.isArray(data.profile.solutions) ? data.profile.solutions : [];
      connectPages('sol', solutions, SOL_PAGE, view.solutionRow, 'entries');
      break;
    }
    case 'leaderboard': {
      title = `Leaderboard: ${data.competition?.title || route.name} | make.fun bounties`;
      root.innerHTML = view.leaderboard(route.name, data);
      const columns = (data.columns || []).filter(column => !column.hidden).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      connectPages('lb', [...(data.entries || []), ...(data.rest || [])], PAGE, row => view.lbRow(row, columns), 'rows');
      break;
    }
    default:
      title = 'Not found | make.fun bounties';
      root.innerHTML = view.notFoundView('That route does not exist.');
  }
  document.title = title;
}

function waitForImages() {
  const images = Array.from(document.images).filter(image => !image.complete);
  if (!images.length) return Promise.resolve();
  return new Promise(resolve => {
    let remaining = images.length;
    const timer = setTimeout(resolve, 5000);
    const finished = () => {
      if (--remaining === 0) { clearTimeout(timer); resolve(); }
    };
    images.forEach(image => {
      image.addEventListener('load', finished, { once: true });
      image.addEventListener('error', finished, { once: true });
    });
  });
}

async function navigate() {
  const version = ++routeVersion;
  window.__shotReady = false;
  root.innerHTML = '<p>Loading…</p>';
  try {
    const route = resolveRoute();
    const data = await loadRoute(route);
    if (version !== routeVersion) return;
    display(route, data);
  } catch (failure) {
    if (version !== routeVersion) return;
    const missing = failure?.status === 404;
    document.title = `${missing ? 'Not found' : 'Error'} | make.fun bounties`;
    root.innerHTML = missing
      ? view.notFoundView('That bounty, leaderboard or profile does not exist, or it is not public.')
      : view.errorView(failure?.message || 'Could not load data from make.fun. Check your connection and try again.');
  }
  if (version !== routeVersion) return;
  window.scrollTo(0, 0);
  await waitForImages();
  if (version === routeVersion) window.__shotReady = true;
}

window.addEventListener('hashchange', navigate);
navigate();
