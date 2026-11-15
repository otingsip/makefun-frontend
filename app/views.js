// The four pages, each a function from API data to HTML. Every value shown
// comes from the live API or from the app itself; nothing is invented.

import { date, day, esc, hasEnded, microMoney, microPct, money, num, shortAddr, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
export const fee = (b) => (b.entryFeeUsd != null && Number(b.entryFeeUsd) > 0 ? `${money(b.entryFeeUsd)} entry` : 'Free entry');

/** An absolute URL for an API image path (avatars, artifacts). */
const apiImg = (u) => (u ? (u.startsWith('http') ? u : `https://make.fun${u}`) : '');

/* ------------------------------------------------------------------ board */

export function boardShell(categories) {
  const opts = categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  return `
    <h1>Open bounties</h1>
    <p class="lede">Live bounties on make.fun, with each one&rsquo;s live pot, entry fee, time left and entries. A bounty past its deadline takes no more entries, even while it still reads &ldquo;open&rdquo;.</p>
    <form class="controls" id="board-controls" role="search" aria-label="Filter bounties">
      <label>Search <input type="search" id="q" placeholder="Title, slug or skill&hellip;" autocomplete="off"></label>
      <label>Category
        <select id="cat"><option value="all">All categories</option>${opts}</select>
      </label>
      <label>Sort by
        <select id="sort">
          <option value="deadline">Closing soon</option>
          <option value="pot">Biggest pot</option>
          <option value="entries">Most entries</option>
          <option value="newest">Newest first</option>
          <option value="title">Title A&ndash;Z</option>
        </select>
      </label>
      <fieldset class="chips" id="status-chips">
        <legend>Status</legend>
        <label><input type="radio" name="st" value="all" checked> All</label>
        <label><input type="radio" name="st" value="open"> Taking entries</label>
        <label><input type="radio" name="st" value="soon"> Ending in 48h</label>
        <label><input type="radio" name="st" value="ended"> Ended, awaiting results</label>
      </fieldset>
    </form>
    <p id="board-count" aria-live="polite"></p>
    <ul class="board" id="board-list"></ul>`;
}

export function boardRow(b) {
  const ended = hasEnded(b.deadline);
  return `
    <li class="card">
      <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
      <p class="meta"><span class="tag">${esc(b.category || 'Bounty')}</span> <span>by ${esc(b.sponsor?.name || 'make.fun')}</span></p>
      <dl class="facts">
        <dt>Live pot</dt><dd><strong>${pot(b)}</strong></dd>
        <dt>Entry fee</dt><dd>${fee(b)}</dd>
        <dt>Time left</dt><dd>${ended ? '<span class="ended">Entries closed</span>' : esc(timeLeft(b.deadline))}</dd>
        <dt>Entries</dt><dd>${num(b.submissionCount)}</dd>
      </dl>
      <p class="links"><a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a> &middot; <a href="#/bounty/${encodeURIComponent(b.slug)}">Details</a></p>
    </li>`;
}

/* ----------------------------------------------------------------- bounty */

function payoutRows(b) {
  if (Array.isArray(b.rewardsNow) && b.rewardsNow.length) {
    return b.rewardsNow
      .map(
        (r) => `<tr><td>${num(r.place)}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td><strong>${money(r.amountUsd)}</strong></td></tr>`,
      )
      .join('');
  }
  if (b.rewards && typeof b.rewards === 'object') {
    return Object.entries(b.rewards)
      .map(([place, amount]) => `<tr><td>${num(place)}</td><td>${money(amount)}</td><td>—</td><td><strong>${money(amount)}</strong></td></tr>`)
      .join('');
  }
  return '';
}

export function bounty(b) {
  const ended = hasEnded(b.deadline);
  const payouts = payoutRows(b);
  const skills = Array.isArray(b.skills) ? b.skills.map((s) => `<li>${esc(s)}</li>`).join('') : '';
  return `
    <p class="crumb"><a href="#/">&larr; All bounties</a></p>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary || '')}</p>
    <p class="meta"><span class="tag">${esc(b.category || 'Bounty')}</span> <span>by ${esc(b.sponsor?.name || 'make.fun')}</span>
      ${b.opensAt && !hasEnded(b.opensAt) ? `<span class="ended">Opens ${date(b.opensAt)}</span>` : ''}</p>
    <dl class="facts facts-wide">
      <dt>Live pot</dt><dd><strong>${pot(b)}</strong>${b.entryFeePayers ? ` <span class="dim">(${num(b.entryFeePayers)} entry fee${b.entryFeePayers === 1 ? '' : 's'} paid in)</span>` : ''}</dd>
      <dt>Entry fee</dt><dd>${fee(b)}</dd>
      <dt>Deadline</dt><dd>${date(b.deadline)} (${ended ? 'ended' : esc(timeLeft(b.deadline))})</dd>
      ${b.opensAt ? `<dt>Opens</dt><dd>${date(b.opensAt)}</dd>` : ''}
      <dt>Entries</dt><dd>${num(b.submissionCount)}${b.submissionsPassed != null ? ` (${num(b.submissionsPassed)} passed)` : ''}</dd>
      <dt>Status</dt><dd>${esc(b.status || '—')}${ended ? ' &middot; entries closed' : ''}</dd>
    </dl>
    <p class="actions"><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a></p>
    ${payouts ? `
    <h2>Payouts <span class="dim">(live pot split)</span></h2>
    <table class="table">
      <thead><tr><th scope="col">Place</th><th scope="col">Base prize</th><th scope="col">Fee share</th><th scope="col">Total now</th></tr></thead>
      <tbody>${payouts}</tbody>
    </table>` : ''}
    ${skills ? `<h2>Skills</h2><ul class="tags">${skills}</ul>` : ''}
    ${b.description ? `<h2>Description</h2><div class="description">${esc(b.description)}</div>` : ''}
    ${b.rules ? `<details><summary>Rules</summary><div class="description">${esc(b.rules)}</div></details>` : ''}
    ${b.resolution?.summary ? `<h2>How it is judged</h2><p>${esc(b.resolution.summary)}</p>` : ''}
    ${Array.isArray(b.notices) && b.notices.length ? `<h2>Notices</h2><ul>${b.notices.map((n) => `<li>${esc(n.title || n.message || '')}${n.createdAt ? ` <span class="dim">(${day(n.createdAt)})</span>` : ''}</li>`).join('')}</ul>` : ''}`;
}

/* ------------------------------------------------------------- leaderboard */

/** One leaderboard cell, formatted from the column's own source so any
 *  harness kind (judge win rate, net PnL, points) reads honestly. */
function lbCell(col, entry) {
  const v = entry.values ? entry.values[col.key] : null;
  if (v == null) return '—';
  const src = col.source || '';
  if (src.includes('win_rate_micro') || src.includes('interval_low_micro') || src.includes('interval_high_micro')) return microPct(v);
  if (src.includes('net_pnl')) return microMoney(v);
  if (col.key === 'bytes') return num(v);
  return esc(entry.display && entry.display[col.key] != null ? entry.display[col.key] : String(v));
}

export function lbRow(entry, cols) {
  const cells = cols.map((c) => `<td>${lbCell(c, entry)}</td>`).join('');
  const badge = entry.house ? ' <span class="tag">house</span>' : entry.baseline ? ' <span class="tag">baseline</span>' : '';
  const range = entry.rank_range && entry.rank_range.best !== entry.rank_range.worst
    ? ` <span class="dim" title="Rank range">(${num(entry.rank_range.best)}–${num(entry.rank_range.worst)})</span>`
    : '';
  return `<tr>
    <td>${num(entry.rank)}${range}</td>
    <td><a href="#/profile/${encodeURIComponent(entry.handle)}">${esc(entry.handle)}</a>${badge}</td>
    <td>${esc(entry.title || '')}</td>
    ${cells}
    <td>${entry.prize_rank != null ? `#${num(entry.prize_rank)}` : '—'}</td>
  </tr>`;
}

export function leaderboard(slug, lb) {
  const cols = (lb.columns || []).filter((c) => !c.hidden).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const rows = [...(lb.entries || []), ...(lb.rest || [])];
  const held = lb.phase?.placements_held;
  const visible = lb.phase?.scores_visible;
  const head = `<tr><th scope="col">Rank</th><th scope="col">Account</th><th scope="col">Entry</th>${cols.map((c) => `<th scope="col">${esc(c.title)}</th>`).join('')}<th scope="col">Prize place</th></tr>`;
  const viewLinks = (lb.views || []).length > 1
    ? `<p class="meta">View: ${(lb.views || []).map((v) => (v === lb.view ? `<strong>${esc(v)}</strong>` : `<a href="#/bounty/${encodeURIComponent(slug)}/leaderboard?view=${encodeURIComponent(v)}">${esc(v)}</a>`)).join(' &middot; ')}</p>`
    : '';
  return `
    <p class="crumb"><a href="#/bounty/${encodeURIComponent(slug)}">&larr; ${esc(lb.competition?.title || slug)}</a> &middot; <a href="#/">All bounties</a></p>
    <h1>Leaderboard: ${esc(lb.competition?.title || slug)}</h1>
    <p class="lede">${esc(lb.title || 'Results')} &middot; phase: ${esc(lb.phase?.title || '—')} &middot; ranked by ${esc(lb.rank_key || '—')}${lb.tie_break ? `, ties broken by ${esc(lb.tie_break.title || lb.tie_break.key)}` : ''}</p>
    ${viewLinks}
    ${held && !rows.length ? `<p class="note">Placements are held until the results are published, so no entries are listed yet.</p>` : ''}
    ${!visible ? `<p class="note">Scores are not visible yet for this phase.</p>` : ''}
    ${rows.length ? `
    <table class="table leaderboard-table">
      <thead>${head}</thead>
      <tbody id="lb-body">${rows.slice(0, 25).map((e) => lbRow(e, cols)).join('')}</tbody>
    </table>
    <p id="lb-count">${num(Math.min(25, rows.length))} of ${num(rows.length)} rows shown.</p>
    ${rows.length > 25 ? `<p><button type="button" id="lb-more">Show more</button></p>` : ''}`
      : `<p>No entries on the board yet for this bounty.</p>`}
    <p class="dim">Win rates are the judge&rsquo;s share of wins (90% interval shown where the board lists it). Rows are the API&rsquo;s own first page plus its stubs, shown 25 at a time.</p>`;
}

/* ----------------------------------------------------------------- profile */

export function solutionRow(s) {
  const c = s.competition || {};
  const score = s.score
    ? `${esc(s.score.column?.title || 'Score')}: ${s.score.column?.source?.includes('win_rate') ? microPct(s.score.value) : esc(s.score.display ?? String(s.score.value ?? ''))}`
    : '—';
  return `<tr>
    <td>${esc(s.title || '')}</td>
    <td><a href="#/bounty/${encodeURIComponent(c.slug)}">${esc(c.title || c.slug || '')}</a></td>
    <td>${s.placement != null ? `#${num(s.placement)}` : '—'}</td>
    <td>${s.prize_usd != null ? money(s.prize_usd) : '—'}</td>
    <td>${score}</td>
    <td>${day(s.entered_at)}</td>
  </tr>`;
}

export function profile(handle, p, movedFrom) {
  const r = p.record || {};
  const sols = Array.isArray(p.solutions) ? p.solutions : [];
  const img = p.image || p.avatar;
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}" rel="noopener">GitHub: ${esc(p.github_login)}</a>`);
  if (p.discord?.url) links.push(`<a href="${esc(p.discord.url)}" rel="noopener">Discord: ${esc(p.discord.username || p.discord.global_name || 'Discord')}</a>`);
  if (p.wallet?.explorer_url) links.push(`<a href="${esc(p.wallet.explorer_url)}" rel="noopener">Wallet: ${esc(shortAddr(p.wallet.address))}</a>`);
  return `
    <p class="crumb"><a href="#/">&larr; All bounties</a></p>
    ${movedFrom && movedFrom !== handle ? `<p class="note">This handle moved: <a href="#/profile/${encodeURIComponent(handle)}">@${esc(handle)}</a> is the current one.</p>` : ''}
    <div class="profile-head">
      ${img ? `<img class="avatar" src="${esc(apiImg(img))}" alt="Avatar of ${esc(handle)}" width="72" height="72" crossorigin="anonymous">` : `<span class="avatar avatar-fallback" aria-hidden="true">${esc(handle.slice(0, 1).toUpperCase())}</span>`}
      <div>
        <h1>${esc(p.display_name || handle)}</h1>
        <p class="meta">@${esc(handle)}${p.house ? ' <span class="tag">house</span>' : ''} &middot; joined ${day(p.joined_at)}</p>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        ${links.length ? `<p class="links">${links.join(' &middot; ')}</p>` : ''}
      </div>
    </div>
    <dl class="facts facts-wide">
      <dt>Competitions entered</dt><dd><strong>${num(r.competitions_entered)}</strong></dd>
      <dt>Placed</dt><dd>${num(r.competitions_placed)}</dd>
      <dt>Won</dt><dd>${num(r.competitions_won)}</dd>
      <dt>Podium finishes</dt><dd>${num(r.podium_finishes)}</dd>
      <dt>Best placement</dt><dd>${r.best_placement != null ? `#${num(r.best_placement)}` : '—'}</dd>
      <dt>Prize money paid</dt><dd><strong>${money(r.prize_usd)}</strong></dd>
    </dl>
    <h2>Entries <span class="dim">(${num(sols.length)} public)</span></h2>
    ${sols.length ? `
    <table class="table">
      <thead><tr><th scope="col">Entry</th><th scope="col">Competition</th><th scope="col">Place</th><th scope="col">Prize</th><th scope="col">Score</th><th scope="col">Entered</th></tr></thead>
      <tbody id="sol-body">${sols.slice(0, 10).map(solutionRow).join('')}</tbody>
    </table>
    <p id="sol-count">${num(Math.min(10, sols.length))} of ${num(sols.length)} entries shown.</p>
    ${sols.length > 10 ? `<p><button type="button" id="sol-more">Show more</button></p>` : ''}`
      : `<p>No public entries yet.</p>`}`;
}

/* ------------------------------------------------------------------- misc */

export function errorView(message) {
  return `<h1>Something went wrong</h1><p>${esc(message)}</p><p><a href="#/">Back to the board</a></p>`;
}

export function notFoundView(what) {
  return `<h1>Not found</h1><p>${esc(what)}</p><p><a href="#/">Back to the board</a></p>`;
}
