import {esc, num, money, microPct, microMoney, date, day, timeLeft, hasEnded, shortAddr} from './format.js';

const many = (values, fn) => values.map(fn).join('');
const dim = value => `<span class="dim">${value}</span>`;
const tag = value => `<span class="tag">${value}</span>`;
const anchor = (href, text, attrs = '') => `<a href="${href}"${attrs}>${text}</a>`;
const bountyUrl = slug => `#/bounty/${encodeURIComponent(slug)}`;
const profileUrl = handle => `#/profile/${encodeURIComponent(handle)}`;
const bold = value => `<strong>${value}</strong>`;
const para = (value, klass = '') => `<p${klass ? ` class="${klass}"` : ''}>${value}</p>`;
const facts = (items, wide = false) => `<dl class="facts${wide ? ' facts-wide' : ''}">${many(items, ([name, value]) => `<dt>${name}</dt><dd>${value}</dd>`)}</dl>`;
const cells = values => `<tr>${many(values, value => `<td>${value}</td>`)}</tr>`;
const table = (heads, body, id = '', klass = '') => `<table class="table${klass ? ` ${klass}` : ''}"><thead><tr>${many(heads, h => `<th scope="col">${h}</th>`)}</tr></thead><tbody${id ? ` id="${id}"` : ''}>${body}</tbody></table>`;
const section = (title, content) => `<h2>${title}</h2>${content}`;
const crumb = value => para(value, 'crumb');
const back = () => crumb(anchor('#/', '&larr; All bounties'));
const attribution = b => `${tag(esc(b.category || 'Bounty'))} <span>by ${esc(b.sponsor?.name || 'make.fun')}</span>`;
const rank = value => value == null ? '—' : `#${num(value)}`;

export function fee(b) {
  return b.entryFeeUsd != null && Number(b.entryFeeUsd) > 0 ? `${money(b.entryFeeUsd)} entry` : 'Free entry';
}
export function pot(b) { return money(b.potUsd ?? b.rewardAmount); }

function paged(items, limit, prefix, headings, render, noun, klass = '') {
  const shown = many(items.slice(0, limit), render);
  const more = items.length > limit ? `<p><button type="button" id="${prefix}-more">Show more</button></p>` : '';
  return table(headings, shown, `${prefix}-body`, klass)
    + `<p id="${prefix}-count">${num(Math.min(limit, items.length))} of ${num(items.length)} ${noun} shown.</p>${more}`;
}

export function boardShell(categories) {
  const select = (id, options) => `<select id="${id}">${many(options, ([value, label]) => `<option value="${esc(value)}">${label}</option>`)}</select>`;
  const category = select('cat', [['all', 'All categories'], ...categories.map(x => [x, esc(x)])]);
  const sorting = select('sort', [['deadline', 'Closing soon'], ['pot', 'Biggest pot'], ['entries', 'Most entries'], ['newest', 'Newest first'], ['title', 'Title A&ndash;Z']]);
  const states = [['all', 'All'], ['open', 'Taking entries'], ['soon', 'Ending in 48h'], ['ended', 'Ended, awaiting results']];
  return '<h1>Open bounties</h1>'
    + para('Live bounties on make.fun, with each one&rsquo;s live pot, entry fee, time left and entries. A bounty past its deadline takes no more entries, even while it still reads &ldquo;open&rdquo;.', 'lede')
    + `<form class="controls" id="board-controls" role="search" aria-label="Filter bounties"><label>Search <input type="search" id="q" placeholder="Title, slug or skill&hellip;" autocomplete="off"></label><label>Category ${category}</label><label>Sort by ${sorting}</label>`
    + `<fieldset class="chips" id="status-chips"><legend>Status</legend>${many(states, ([value, label]) => `<label><input type="radio" name="st" value="${value}"${value === 'all' ? ' checked' : ''}> ${label}</label>`)}</fieldset></form>`
    + '<p id="board-count" aria-live="polite"></p><ul class="board" id="board-list"></ul>';
}

export function boardRow(b) {
  const href = bountyUrl(b.slug);
  const clock = hasEnded(b.deadline) ? '<span class="ended">Entries closed</span>' : esc(timeLeft(b.deadline));
  return `<li class="card"><h2>${anchor(href, esc(b.title))}</h2>`
    + para(attribution(b), 'meta')
    + facts([['Live pot', bold(pot(b))], ['Entry fee', fee(b)], ['Time left', clock], ['Entries', num(b.submissionCount)]])
    + para(`${anchor(`${href}/leaderboard`, 'Leaderboard')} &middot; ${anchor(href, 'Details')}`, 'links') + '</li>';
}

function payouts(b) {
  let rows = [];
  if (Array.isArray(b.rewardsNow) && b.rewardsNow.length) {
    rows = b.rewardsNow.map(prize => [num(prize.place), money(prize.baseUsd), money(prize.feeShareUsd), bold(money(prize.amountUsd))]);
  } else if (b.rewards && typeof b.rewards === 'object') {
    rows = Object.entries(b.rewards).map(([place, amount]) => [num(place), money(amount), '—', bold(money(amount))]);
  }
  return rows.length ? section('Payouts ' + dim('(live pot split)'), table(['Place', 'Base prize', 'Fee share', 'Total now'], many(rows, cells))) : '';
}

export function bounty(b) {
  const closed = hasEnded(b.deadline);
  const paid = b.entryFeePayers ? ` ${dim(`(${num(b.entryFeePayers)} entry fee${b.entryFeePayers === 1 ? '' : 's'} paid in)`)}` : '';
  const factsList = [['Live pot', bold(pot(b)) + paid], ['Entry fee', fee(b)], ['Deadline', `${date(b.deadline)} (${closed ? 'ended' : esc(timeLeft(b.deadline))})`]];
  if (b.opensAt) factsList.push(['Opens', date(b.opensAt)]);
  factsList.push(['Entries', num(b.submissionCount) + (b.submissionsPassed != null ? ` (${num(b.submissionsPassed)} passed)` : '')]);
  factsList.push(['Status', esc(b.status || '—') + (closed ? ' &middot; entries closed' : '')]);
  const opening = b.opensAt && !hasEnded(b.opensAt) ? ` <span class="ended">Opens ${date(b.opensAt)}</span>` : '';
  let html = back() + `<h1>${esc(b.title)}</h1>` + para(esc(b.summary || ''), 'lede')
    + para(attribution(b) + opening, 'meta') + facts(factsList, true)
    + para(anchor(`${bountyUrl(b.slug)}/leaderboard`, 'View leaderboard', ' class="btn"'), 'actions') + payouts(b);
  if (Array.isArray(b.skills) && b.skills.length) html += section('Skills', `<ul class="tags">${many(b.skills, s => `<li>${esc(s)}</li>`)}</ul>`);
  if (b.description) html += section('Description', `<div class="description">${esc(b.description)}</div>`);
  if (b.rules) html += `<details><summary>Rules</summary><div class="description">${esc(b.rules)}</div></details>`;
  if (b.resolution?.summary) html += section('How it is judged', para(esc(b.resolution.summary)));
  if (Array.isArray(b.notices) && b.notices.length) html += section('Notices', `<ul>${many(b.notices, n => `<li>${esc(n.title || n.message || '')}${n.createdAt ? ' ' + dim('(' + day(n.createdAt) + ')') : ''}</li>`)}</ul>`);
  return html;
}

function metric(entry, column) {
  const value = entry.values ? entry.values[column.key] : null;
  if (value == null) return '—';
  const source = column.source || '';
  if (['win_rate_micro', 'interval_low_micro', 'interval_high_micro'].some(token => source.includes(token))) return microPct(value);
  if (source.includes('net_pnl')) return microMoney(value);
  if (column.key === 'bytes') return num(value);
  return esc(entry.display?.[column.key] ?? String(value));
}

export function lbRow(entry, columns) {
  const range = entry.rank_range;
  const suffix = range && range.best !== range.worst ? ` <span class="dim" title="Rank range">(${num(range.best)}–${num(range.worst)})</span>` : '';
  const badge = entry.house ? 'house' : entry.baseline ? 'baseline' : '';
  return cells([num(entry.rank) + suffix, anchor(profileUrl(entry.handle), esc(entry.handle)) + (badge ? ' ' + tag(badge) : ''),
    esc(entry.title || ''), ...columns.map(column => metric(entry, column)), rank(entry.prize_rank)]);
}

export function leaderboard(slug, lb) {
  const title = esc(lb.competition?.title || slug);
  const columns = (lb.columns || []).filter(c => !c.hidden).sort((a,b) => (a.index ?? 0) - (b.index ?? 0));
  const entries = [...(lb.entries || []), ...(lb.rest || [])];
  let html = crumb(`${anchor(bountyUrl(slug), '&larr; ' + title)} &middot; ${anchor('#/', 'All bounties')}`)
    + `<h1>Leaderboard: ${title}</h1>`
    + para(`${esc(lb.title || 'Results')} &middot; phase: ${esc(lb.phase?.title || '—')} &middot; ranked by ${esc(lb.rank_key || '—')}${lb.tie_break ? ', ties broken by ' + esc(lb.tie_break.title || lb.tie_break.key) : ''}`, 'lede');
  if ((lb.views || []).length > 1) html += para('View: ' + lb.views.map(view => view === lb.view ? bold(esc(view)) : anchor(`${bountyUrl(slug)}/leaderboard?view=${encodeURIComponent(view)}`, esc(view))).join(' &middot; '), 'meta');
  if (lb.phase?.placements_held && !entries.length) html += para('Placements are held until the results are published, so no entries are listed yet.', 'note');
  if (!lb.phase?.scores_visible) html += para('Scores are not visible yet for this phase.', 'note');
  html += entries.length ? paged(entries, 25, 'lb', ['Rank', 'Account', 'Entry', ...columns.map(c => esc(c.title)), 'Prize place'], e => lbRow(e, columns), 'rows', 'leaderboard-table') : para('No entries on the board yet for this bounty.');
  return html + para('Win rates are the judge&rsquo;s share of wins (90% interval shown where the board lists it). Rows are the API&rsquo;s own first page plus its stubs, shown 25 at a time.', 'dim');
}

export function solutionRow(solution) {
  const competition = solution.competition || {};
  let score = '—';
  if (solution.score) {
    const data = solution.score;
    score = esc(data.column?.title || 'Score') + ': ' + (data.column?.source?.includes('win_rate') ? microPct(data.value) : esc(data.display ?? String(data.value ?? '')));
  }
  return cells([esc(solution.title || ''), anchor(bountyUrl(competition.slug), esc(competition.title || competition.slug || '')),
    rank(solution.placement), solution.prize_usd != null ? money(solution.prize_usd) : '—', score, day(solution.entered_at)]);
}

function identity(handle, p) {
  const picture = p.image || p.avatar;
  const avatar = picture
    ? `<img class="avatar" src="${esc(picture.startsWith('http') ? picture : 'https://make.fun' + picture)}" alt="Avatar of ${esc(handle)}" width="72" height="72" crossorigin="anonymous">`
    : `<span class="avatar avatar-fallback" aria-hidden="true">${esc(handle.slice(0,1).toUpperCase())}</span>`;
  const links = [];
  const external = (url, label) => anchor(esc(url), label, ' rel="noopener"');
  if (p.github_login) links.push(external('https://github.com/' + encodeURIComponent(p.github_login), 'GitHub: ' + esc(p.github_login)));
  if (p.discord?.url) links.push(external(p.discord.url, 'Discord: ' + esc(p.discord.username || p.discord.global_name || 'Discord')));
  if (p.wallet?.explorer_url) links.push(external(p.wallet.explorer_url, 'Wallet: ' + esc(shortAddr(p.wallet.address))));
  return `<div class="profile-head">${avatar}<div><h1>${esc(p.display_name || handle)}</h1>`
    + para('@' + esc(handle) + (p.house ? ' ' + tag('house') : '') + ' &middot; joined ' + day(p.joined_at), 'meta')
    + (p.bio ? para(esc(p.bio)) : '') + (links.length ? para(links.join(' &middot; '), 'links') : '') + '</div></div>';
}

export function profile(handle, p, movedFrom) {
  const record = p.record || {};
  const entries = Array.isArray(p.solutions) ? p.solutions : [];
  const moved = movedFrom && movedFrom !== handle ? para('This handle moved: ' + anchor(profileUrl(handle), '@' + esc(handle)) + ' is the current one.', 'note') : '';
  return back() + moved + identity(handle, p) + facts([
    ['Competitions entered', bold(num(record.competitions_entered))], ['Placed', num(record.competitions_placed)],
    ['Won', num(record.competitions_won)], ['Podium finishes', num(record.podium_finishes)],
    ['Best placement', rank(record.best_placement)], ['Prize money paid', bold(money(record.prize_usd))],
  ], true) + section('Entries ' + dim('(' + num(entries.length) + ' public)'), entries.length
    ? paged(entries, 10, 'sol', ['Entry', 'Competition', 'Place', 'Prize', 'Score', 'Entered'], solutionRow, 'entries')
    : para('No public entries yet.'));
}

const failure = (heading, message) => `<h1>${heading}</h1>${para(esc(message))}${para(anchor('#/', 'Back to the board'))}`;
export const notFoundView = what => failure('Not found', what);
export const errorView = message => failure('Something went wrong', message);
