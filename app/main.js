// A make.fun frontend: the board, a bounty page, its leaderboard and an
// account's public profile, on hash routes.
//
//   #/                          the board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard (?view=overall|performance)
//   #/profile/<handle>          an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is
// on screen, so a screenshot script knows when to capture.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { boardRow, boardShell, bounty, errorView, lbRow, leaderboard, notFoundView, profile, solutionRow } from './views.js';
import { hasEnded, money } from './format.js';

const app = document.getElementById('app');
const PAGE = 25;
const SOL_PAGE = 10;

let boardItems = [];
let boardState = { q: '', cat: 'all', sort: 'deadline', st: 'all' };
let pageRows = null; // { rows, cols, shown } for the leaderboard "Show more" button
let pageSols = null; // { sols, shown } for the profile "Show more" button

function setReady() {
  window.__shotReady = true;
}

/** Let the page's images (e.g. a profile avatar) finish loading — or 5 s,
 *  whichever comes first — before signalling that a screenshot may be taken. */
function waitForImages() {
  const pending = [...document.images].filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.all(pending.map((img) => new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    }))),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

function potOf(b) {
  return Number(b.potUsd ?? b.rewardAmount ?? 0) || 0;
}

function filteredBoard() {
  const q = boardState.q.trim().toLowerCase();
  let list = boardItems.filter((b) => {
    if (boardState.cat !== 'all' && b.category !== boardState.cat) return false;
    if (q) {
      const hay = `${b.title || ''} ${b.slug || ''} ${b.category || ''} ${(b.skills || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const ended = hasEnded(b.deadline);
    if (boardState.st === 'open' && ended) return false;
    if (boardState.st === 'soon' && (ended || new Date(b.deadline).getTime() - Date.now() > 48 * 3600000)) return false;
    if (boardState.st === 'ended' && !ended) return false;
    return true;
  });
  const by = boardState.sort;
  const openFirst = (a, b) => (hasEnded(a.deadline) - hasEnded(b.deadline)) || (new Date(a.deadline) - new Date(b.deadline));
  if (by === 'deadline') list.sort(openFirst);
  else if (by === 'pot') list.sort((a, b) => potOf(b) - potOf(a));
  else if (by === 'entries') list.sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0));
  else if (by === 'newest') list.sort((a, b) => new Date(b.publishedAt || b.deadline) - new Date(a.publishedAt || a.deadline));
  else if (by === 'title') list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return list;
}

/** Re-render only the board list and its count, keeping the search box focused. */
function renderBoardList() {
  const listEl = document.getElementById('board-list');
  const countEl = document.getElementById('board-count');
  if (!listEl) return;
  const list = filteredBoard();
  const totalPot = list.reduce((s, b) => s + potOf(b), 0);
  listEl.innerHTML = list.length
    ? list.map(boardRow).join('')
    : '<li>No bounties match these filters.</li>';
  if (countEl) {
    countEl.textContent = `${list.length} of ${boardItems.length} bounties · ${money(totalPot)} total live pot`;
  }
}

async function renderBoard() {
  document.title = 'make.fun bounties';
  const data = await getBounties();
  boardItems = data.items || [];
  const categories = [...new Set(boardItems.map((b) => b.category).filter(Boolean))].sort();
  app.innerHTML = boardShell(categories);
  const q = document.getElementById('q');
  const cat = document.getElementById('cat');
  const sort = document.getElementById('sort');
  q.addEventListener('input', () => {
    boardState.q = q.value;
    renderBoardList();
  });
  cat.addEventListener('change', () => {
    boardState.cat = cat.value;
    renderBoardList();
  });
  sort.addEventListener('change', () => {
    boardState.sort = sort.value;
    renderBoardList();
  });
  document.getElementById('status-chips').addEventListener('change', (ev) => {
    boardState.st = ev.target.value;
    renderBoardList();
  });
  renderBoardList();
}

async function renderBounty(slug) {
  const b = await getBounty(slug);
  document.title = `${b.title} | make.fun bounties`;
  app.innerHTML = bounty(b);
}

async function renderLeaderboard(slug, view) {
  const lb = await getLeaderboard(slug, view);
  document.title = `Leaderboard: ${lb.competition?.title || slug} | make.fun bounties`;
  app.innerHTML = leaderboard(slug, lb);
  const cols = (lb.columns || []).filter((c) => !c.hidden).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const rows = [...(lb.entries || []), ...(lb.rest || [])];
  pageRows = { rows, cols, shown: Math.min(PAGE, rows.length) };
  const more = document.getElementById('lb-more');
  if (more) {
    more.addEventListener('click', () => {
      const body = document.getElementById('lb-body');
      const count = document.getElementById('lb-count');
      const next = pageRows.rows.slice(pageRows.shown, pageRows.shown + PAGE);
      body.insertAdjacentHTML('beforeend', next.map((e) => lbRow(e, pageRows.cols)).join(''));
      pageRows.shown += next.length;
      if (count) count.textContent = `${pageRows.shown} of ${pageRows.rows.length} rows shown.`;
      if (pageRows.shown >= pageRows.rows.length) more.remove();
    });
  }
}

async function renderProfile(handle) {
  const { profile: p, current } = await getProfile(handle);
  document.title = `@${current} | make.fun bounties`;
  app.innerHTML = profile(current, p, handle);
  const sols = Array.isArray(p.solutions) ? p.solutions : [];
  pageSols = { sols, shown: Math.min(SOL_PAGE, sols.length) };
  const more = document.getElementById('sol-more');
  if (more) {
    more.addEventListener('click', () => {
      const body = document.getElementById('sol-body');
      const count = document.getElementById('sol-count');
      const next = pageSols.sols.slice(pageSols.shown, pageSols.shown + SOL_PAGE);
      body.insertAdjacentHTML('beforeend', next.map(solutionRow).join(''));
      pageSols.shown += next.length;
      if (count) count.textContent = `${pageSols.shown} of ${pageSols.sols.length} entries shown.`;
      if (pageSols.shown >= pageSols.sols.length) more.remove();
    });
  }
}

async function render() {
  window.__shotReady = false;
  pageRows = null;
  pageSols = null;
  app.innerHTML = '<p>Loading…</p>';
  const hash = location.hash.replace(/^#/, '');
  const [pathPart, queryPart] = hash.split('?');
  const query = new URLSearchParams(queryPart || '');
  try {
    const lbMatch = pathPart.match(/^\/bounty\/([^/]+)\/leaderboard$/);
    const bMatch = pathPart.match(/^\/bounty\/([^/]+)$/);
    const pMatch = pathPart.match(/^\/(?:profile|u|account)\/([^/]+)$/);
    if (lbMatch) {
      await renderLeaderboard(decodeURIComponent(lbMatch[1]), query.get('view'));
    } else if (bMatch) {
      await renderBounty(decodeURIComponent(bMatch[1]));
    } else if (pMatch) {
      await renderProfile(decodeURIComponent(pMatch[1]));
    } else {
      await renderBoard();
    }
  } catch (err) {
    if (err && err.status === 404) {
      document.title = 'Not found | make.fun bounties';
      app.innerHTML = notFoundView('That bounty, leaderboard or profile does not exist, or it is not public.');
    } else {
      document.title = 'Error | make.fun bounties';
      app.innerHTML = errorView(err && err.message ? err.message : 'Could not load data from make.fun. Check your connection and try again.');
    }
  }
  window.scrollTo(0, 0);
  await waitForImages();
  setReady();
}

window.addEventListener('hashchange', render);
render();
