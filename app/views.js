// Route markup is assembled from small, escaped display fragments.
import { esc, num, money, microPct, microMoney, date, day, timeLeft, hasEnded, shortAddr } from './format.js';

const join = (items, render) => items.map(render).join('');
const dim = content => `<span class="dim">${content}</span>`;
const tag = content => `<span class="tag">${content}</span>`;
const link = (href, content, attributes = '') => `<a href="${href}"${attributes}>${content}</a>`;
const route = slug => '#/bounty/' + encodeURIComponent(slug);
const account = handle => '#/profile/' + encodeURIComponent(handle);
const strong = content => `<strong>${content}</strong>`;
const paragraph = (content, className = '') => `<p${className ? ` class="${className}"` : ''}>${content}</p>`;
const facts = (items, wide = false) => `<dl class="facts${wide ? ' facts-wide' : ''}">${join(items, ([label, content]) => `<dt>${label}</dt><dd>${content}</dd>`)}</dl>`;
const row = cells => `<tr>${join(cells, content => `<td>${content}</td>`)}</tr>`;
const table = (headings, body, bodyId = '', extraClass = '') =>
  `<table class="table${extraClass ? ' ' + extraClass : ''}"><thead><tr>${join(headings, heading => `<th scope="col">${heading}</th>`)}</tr></thead><tbody${bodyId ? ` id="${bodyId}"` : ''}>${body}</tbody></table>`;
const crumb = content => paragraph(content, 'crumb');
const back = () => crumb(link('#/', '&larr; All bounties'));
const sponsor = b => tag(esc(b.category || 'Bounty')) + ' <span>by ' + esc(b.sponsor?.name || 'make.fun') + '</span>';
const section = (title, content) => `<h2>${title}</h2>${content}`;
const rank = value => value == null ? '—' : '#' + num(value);

export function fee(b) {
  return b.entryFeeUsd != null && Number(b.entryFeeUsd) > 0
    ? money(b.entryFeeUsd) + ' entry' : 'Free entry';
}
export function pot(b) { return money(b.potUsd ?? b.rewardAmount); }

function pageTable(items, size, prefix, headings, renderer, noun, extraClass = '') {
  return table(headings, join(items.slice(0, size), renderer), prefix + '-body', extraClass)
    + `<p id="${prefix}-count">${num(Math.min(size, items.length))} of ${num(items.length)} ${noun} shown.</p>`
    + (items.length > size ? `<p><button type="button" id="${prefix}-more">Show more</button></p>` : '');
}

export function boardShell(categories) {
  const select = (id, choices) => `<select id="${id}">${join(choices, ([value, label]) => `<option value="${esc(value)}">${label}</option>`)}</select>`;
  const categoriesMenu = select('cat', [['all', 'All categories'], ...categories.map(value => [value, esc(value)])]);
  const sortingMenu = select('sort', [['deadline', 'Closing soon'], ['pot', 'Biggest pot'], ['entries', 'Most entries'], ['newest', 'Newest first'], ['title', 'Title A&ndash;Z']]);
  const statuses = [['all', 'All'], ['open', 'Taking entries'], ['soon', 'Ending in 48h'], ['ended', 'Ended, awaiting results']];
  return '<h1>Open bounties</h1>'
    + paragraph('Live bounties on make.fun, with each one&rsquo;s live pot, entry fee, time left and entries. A bounty past its deadline takes no more entries, even while it still reads &ldquo;open&rdquo;.', 'lede')
    + `<form class="controls" id="board-controls" role="search" aria-label="Filter bounties"><label>Search <input type="search" id="q" placeholder="Title, slug or skill&hellip;" autocomplete="off"></label><label>Category ${categoriesMenu}</label><label>Sort by ${sortingMenu}</label>`
    + `<fieldset class="chips" id="status-chips"><legend>Status</legend>${join(statuses, ([value, label]) => `<label><input type="radio" name="st" value="${value}"${value === 'all' ? ' checked' : ''}> ${label}</label>`)}</fieldset></form>`
    + '<p id="board-count" aria-live="polite"></p><ul class="board" id="board-list"></ul>';
}

export function boardRow(b) {
  const href = route(b.slug);
  const clock = hasEnded(b.deadline) ? '<span class="ended">Entries closed</span>' : esc(timeLeft(b.deadline));
  return `<li class="card"><h2>${link(href, esc(b.title))}</h2>`
    + paragraph(sponsor(b), 'meta')
    + facts([['Live pot', strong(pot(b))], ['Entry fee', fee(b)], ['Time left', clock], ['Entries', num(b.submissionCount)]])
    + paragraph(link(href + '/leaderboard', 'Leaderboard') + ' &middot; ' + link(href, 'Details'), 'links') + '</li>';
}

function prizes(b) {
  let entries = [];
  if (Array.isArray(b.rewardsNow) && b.rewardsNow.length) {
    entries = b.rewardsNow.map(prize => [num(prize.place), money(prize.baseUsd), money(prize.feeShareUsd), strong(money(prize.amountUsd))]);
  } else if (b.rewards && typeof b.rewards === 'object') {
    entries = Object.entries(b.rewards).map(([place, amount]) => [num(place), money(amount), '—', strong(money(amount))]);
  }
  return entries.length ? section('Payouts ' + dim('(live pot split)'), table(['Place', 'Base prize', 'Fee share', 'Total now'], join(entries, row))) : '';
}

export function bounty(b) {
  const closed = hasEnded(b.deadline);
  const paid = b.entryFeePayers ? ' ' + dim(`(${num(b.entryFeePayers)} entry fee${b.entryFeePayers === 1 ? '' : 's'} paid in)`) : '';
  const details = [
    ['Live pot', strong(pot(b)) + paid], ['Entry fee', fee(b)],
    ['Deadline', `${date(b.deadline)} (${closed ? 'ended' : esc(timeLeft(b.deadline))})`],
  ];
  if (b.opensAt) details.push(['Opens', date(b.opensAt)]);
  details.push(['Entries', num(b.submissionCount) + (b.submissionsPassed != null ? ` (${num(b.submissionsPassed)} passed)` : '')],
    ['Status', esc(b.status || '—') + (closed ? ' &middot; entries closed' : '')]);
  const opening = b.opensAt && !hasEnded(b.opensAt) ? ` <span class="ended">Opens ${date(b.opensAt)}</span>` : '';
  let output = back() + `<h1>${esc(b.title)}</h1>` + paragraph(esc(b.summary || ''), 'lede')
    + paragraph(sponsor(b) + opening, 'meta') + facts(details, true)
    + paragraph(link(route(b.slug) + '/leaderboard', 'View leaderboard', ' class="btn"'), 'actions') + prizes(b);
  if (Array.isArray(b.skills) && b.skills.length) output += section('Skills', `<ul class="tags">${join(b.skills, skill => `<li>${esc(skill)}</li>`)}</ul>`);
  if (b.description) output += section('Description', `<div class="description">${esc(b.description)}</div>`);
  if (b.rules) output += `<details><summary>Rules</summary><div class="description">${esc(b.rules)}</div></details>`;
  if (b.resolution?.summary) output += section('How it is judged', paragraph(esc(b.resolution.summary)));
  if (Array.isArray(b.notices) && b.notices.length) output += section('Notices', `<ul>${join(b.notices, notice => `<li>${esc(notice.title || notice.message || '')}${notice.createdAt ? ' ' + dim('(' + day(notice.createdAt) + ')') : ''}</li>`)}</ul>`);
  return output;
}

function metric(entry, column) {
  const value = entry.values ? entry.values[column.key] : null;
  if (value == null) return '—';
  const source = column.source || '';
  if (['win_rate_micro', 'interval_low_micro', 'interval_high_micro'].some(part => source.includes(part))) return microPct(value);
  if (source.includes('net_pnl')) return microMoney(value);
  if (column.key === 'bytes') return num(value);
  return esc(entry.display?.[column.key] ?? String(value));
}

export function lbRow(entry, cols) {
  const range = entry.rank_range;
  const spread = range && range.best !== range.worst ? ` <span class="dim" title="Rank range">(${num(range.best)}–${num(range.worst)})</span>` : '';
  const badge = entry.house ? 'house' : entry.baseline ? 'baseline' : '';
  return row([num(entry.rank) + spread, link(account(entry.handle), esc(entry.handle)) + (badge ? ' ' + tag(badge) : ''),
    esc(entry.title || ''), ...cols.map(column => metric(entry, column)), rank(entry.prize_rank)]);
}

export function leaderboard(slug, lb) {
  const title = esc(lb.competition?.title || slug);
  const columns = (lb.columns || []).filter(column => !column.hidden).sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  const entries = [...(lb.entries || []), ...(lb.rest || [])];
  let output = crumb(link(route(slug), '&larr; ' + title) + ' &middot; ' + link('#/', 'All bounties'))
    + `<h1>Leaderboard: ${title}</h1>`
    + paragraph(`${esc(lb.title || 'Results')} &middot; phase: ${esc(lb.phase?.title || '—')} &middot; ranked by ${esc(lb.rank_key || '—')}${lb.tie_break ? ', ties broken by ' + esc(lb.tie_break.title || lb.tie_break.key) : ''}`, 'lede');
  if ((lb.views || []).length > 1) output += paragraph('View: ' + lb.views.map(view => view === lb.view ? strong(esc(view)) : link(route(slug) + '/leaderboard?view=' + encodeURIComponent(view), esc(view))).join(' &middot; '), 'meta');
  if (lb.phase?.placements_held && !entries.length) output += paragraph('Placements are held until the results are published, so no entries are listed yet.', 'note');
  if (!lb.phase?.scores_visible) output += paragraph('Scores are not visible yet for this phase.', 'note');
  output += entries.length ? pageTable(entries, 25, 'lb', ['Rank', 'Account', 'Entry', ...columns.map(column => esc(column.title)), 'Prize place'], entry => lbRow(entry, columns), 'rows', 'leaderboard-table') : paragraph('No entries on the board yet for this bounty.');
  return output + paragraph('Win rates are the judge&rsquo;s share of wins (90% interval shown where the board lists it). Rows are the API&rsquo;s own first page plus its stubs, shown 25 at a time.', 'dim');
}

export function solutionRow(solution) {
  const competition = solution.competition || {};
  let score = '—';
  if (solution.score) {
    const data = solution.score;
    score = esc(data.column?.title || 'Score') + ': ' + (data.column?.source?.includes('win_rate')
      ? microPct(data.value) : esc(data.display ?? String(data.value ?? '')));
  }
  return row([esc(solution.title || ''), link(route(competition.slug), esc(competition.title || competition.slug || '')),
    rank(solution.placement), solution.prize_usd != null ? money(solution.prize_usd) : '—', score, day(solution.entered_at)]);
}

function identity(handle, p) {
  const image = p.image || p.avatar;
  const avatar = image
    ? `<img class="avatar" src="${esc(image.startsWith('http') ? image : 'https://make.fun' + image)}" alt="Avatar of ${esc(handle)}" width="72" height="72" crossorigin="anonymous">`
    : `<span class="avatar avatar-fallback" aria-hidden="true">${esc(handle.slice(0, 1).toUpperCase())}</span>`;
  const links = [];
  const external = (url, label) => link(esc(url), label, ' rel="noopener"');
  if (p.github_login) links.push(external('https://github.com/' + encodeURIComponent(p.github_login), 'GitHub: ' + esc(p.github_login)));
  if (p.discord?.url) links.push(external(p.discord.url, 'Discord: ' + esc(p.discord.username || p.discord.global_name || 'Discord')));
  if (p.wallet?.explorer_url) links.push(external(p.wallet.explorer_url, 'Wallet: ' + esc(shortAddr(p.wallet.address))));
  return `<div class="profile-head">${avatar}<div><h1>${esc(p.display_name || handle)}</h1>`
    + paragraph('@' + esc(handle) + (p.house ? ' ' + tag('house') : '') + ' &middot; joined ' + day(p.joined_at), 'meta')
    + (p.bio ? paragraph(esc(p.bio)) : '') + (links.length ? paragraph(links.join(' &middot; '), 'links') : '') + '</div></div>';
}

export function profile(handle, p, movedFrom) {
  const record = p.record || {};
  const entries = Array.isArray(p.solutions) ? p.solutions : [];
  const moved = movedFrom && movedFrom !== handle ? paragraph('This handle moved: ' + link(account(handle), '@' + esc(handle)) + ' is the current one.', 'note') : '';
  return back() + moved + identity(handle, p) + facts([
    ['Competitions entered', strong(num(record.competitions_entered))], ['Placed', num(record.competitions_placed)],
    ['Won', num(record.competitions_won)], ['Podium finishes', num(record.podium_finishes)],
    ['Best placement', rank(record.best_placement)], ['Prize money paid', strong(money(record.prize_usd))],
  ], true) + section('Entries ' + dim('(' + num(entries.length) + ' public)'), entries.length
    ? pageTable(entries, 10, 'sol', ['Entry', 'Competition', 'Place', 'Prize', 'Score', 'Entered'], solutionRow, 'entries')
    : paragraph('No public entries yet.'));
}

const failure = (heading, message) => `<h1>${heading}</h1>` + paragraph(esc(message)) + paragraph(link('#/', 'Back to the board'));
export const notFoundView = what => failure('Not found', what);
export const errorView = message => failure('Something went wrong', message);
