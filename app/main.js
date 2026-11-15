import * as api from './api.js';
import * as views from './views.js';
import { money, hasEnded } from './format.js';

const app = document.getElementById('app'), PAGE = 25, SOL_PAGE = 10;
const state = { q: '', cat: 'all', sort: 'deadline', st: 'all' };
let items = [], version = 0;
const $ = id => document.getElementById(id), ms = value => new Date(value).getTime();
const pot = item => Number(item.potUsd ?? item.rewardAmount ?? 0) || 0;

function boardItems() {
  const q = state.q.trim().toLowerCase();
  const found = items.filter(item => {
    const ended = hasEnded(item.deadline), soon = !ended && ms(item.deadline) - Date.now() <= 172800000;
    const text = [item.title, item.slug, item.category, ...(item.skills || [])].filter(Boolean).join(' ').toLowerCase();
    return (state.cat === 'all' || item.category === state.cat) && (!q || text.includes(q)) && (state.st === 'all' || state.st === 'ended' && ended || state.st === 'open' && !ended || state.st === 'soon' && soon);
  });
  const sort = {
    deadline: (a, b) => Number(hasEnded(a.deadline)) - Number(hasEnded(b.deadline)) || ms(a.deadline) - ms(b.deadline),
    pot: (a, b) => pot(b) - pot(a), entries: (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0),
    newest: (a, b) => ms(b.publishedAt || b.deadline) - ms(a.publishedAt || a.deadline), title: (a, b) => String(a.title).localeCompare(String(b.title))
  };
  found.sort(sort[state.sort] || sort.deadline); return found;
}
function refreshBoard() {
  const rows = boardItems();
  $('board-list').innerHTML = rows.length ? rows.map(views.boardRow).join('') : '<li>No bounties match these filters.</li>';
  $('board-count').textContent = `${rows.length} of ${items.length} bounties · ${money(rows.reduce((n, x) => n + pot(x), 0))} total live pot`;
}
function setupBoard(data) {
  items = data.items || [];
  app.innerHTML = views.boardShell([...new Set(items.map(x => x.category).filter(Boolean))].sort());
  ['q', 'cat', 'sort'].forEach(id => { const control = $(id); control.value = state[id]; if (id === 'cat' && !control.value) control.value = state.cat = 'all'; control.addEventListener(id === 'q' ? 'input' : 'change', () => { state[id] = control.value; refreshBoard(); }); });
  const selected = document.querySelector(`input[name="st"][value="${state.st}"]`); if (selected) selected.checked = true;
  $('status-chips').addEventListener('change', event => { state.st = event.target.value; refreshBoard(); });
  $('board-controls').addEventListener('submit', event => event.preventDefault()); refreshBoard();
}
function pages(prefix, rows, size, render, noun) {
  const more = $(`${prefix}-more`); if (!more) return;
  let shown = Math.min(size, rows.length);
  const update = () => { const count = $(`${prefix}-count`); if (count) count.textContent = `${shown} of ${rows.length} ${noun} shown.`; if (shown >= rows.length) more.remove(); };
  more.addEventListener('click', () => { const next = rows.slice(shown, shown + size); $(`${prefix}-body`).insertAdjacentHTML('beforeend', next.map(render).join('')); shown += next.length; update(); });
}
function parseRoute() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  if (!path || path === '/') return { type: 'board' };
  const match = path.match(/^\/(bounty|profile|u|account)\/([^/]+)(\/leaderboard)?$/);
  if (!match || (match[3] && match[1] !== 'bounty')) return { type: 'missing' };
  return { type: match[3] ? 'leaderboard' : match[1] === 'bounty' ? 'bounty' : 'profile', name: decodeURIComponent(match[2]), view: new URLSearchParams(query).get('view') };
}
function load(route) {
  if (route.type === 'board') return api.getBounties();
  if (route.type === 'bounty') return api.getBounty(route.name);
  if (route.type === 'leaderboard') return api.getLeaderboard(route.name, route.view);
  if (route.type === 'profile') return api.getProfile(route.name);
  return Promise.resolve(null);
}
function render(route, data) {
  if (route.type === 'board') { document.title = 'make.fun bounties'; setupBoard(data); return; }
  if (route.type === 'bounty') { document.title = `${data.title} | make.fun bounties`; app.innerHTML = views.bounty(data); return; }
  if (route.type === 'profile') { document.title = `@${data.current} | make.fun bounties`; app.innerHTML = views.profile(data.current, data.profile, route.name); pages('sol', data.profile.solutions || [], SOL_PAGE, views.solutionRow, 'entries'); return; }
  if (route.type === 'leaderboard') { document.title = `Leaderboard: ${data.competition?.title || route.name} | make.fun bounties`; app.innerHTML = views.leaderboard(route.name, data); const cols = (data.columns || []).filter(x => !x.hidden).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)); pages('lb', [...(data.entries || []), ...(data.rest || [])], PAGE, row => views.lbRow(row, cols), 'rows'); return; }
  document.title = 'Not found | make.fun bounties'; app.innerHTML = views.notFoundView('That route does not exist.');
}
function waitImages() { const pending = [...document.images].filter(x => !x.complete); if (!pending.length) return Promise.resolve(); return new Promise(resolve => { let left = pending.length, done = () => --left === 0 && resolve(); pending.forEach(x => { x.addEventListener('load', done, { once: true }); x.addEventListener('error', done, { once: true }); }); setTimeout(resolve, 5000); }); }
async function navigate() {
  const mine = ++version; window.__shotReady = false; app.innerHTML = '<p>Loading…</p>'; const route = parseRoute();
  try { const data = await load(route); if (mine !== version) return; render(route, data); }
  catch (error) { if (mine !== version) return; const missing = error?.status === 404; document.title = `${missing ? 'Not found' : 'Error'} | make.fun bounties`; app.innerHTML = missing ? views.notFoundView('That bounty, leaderboard or profile does not exist, or it is not public.') : views.errorView(error?.message || 'Could not load data from make.fun. Check your connection and try again.'); }
  if (mine !== version) return; window.scrollTo(0, 0); await waitImages(); if (mine === version) window.__shotReady = true;
}
window.addEventListener('hashchange', navigate); navigate();
