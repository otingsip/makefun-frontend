import {esc, money, num, microMoney, microPct, date, day, hasEnded, timeLeft, shortAddr} from './format.js';

// Markup helpers accept already escaped content; API text is escaped at its boundary.
const join = (list, render) => list.map(render).join('');
const element = (name, content, attributes = '') => `<${name}${attributes}>${content}</${name}>`;
const styled = (name, content, css) => element(name, content, css ? ` class="${css}"` : '');
const p = (content, css = '') => styled('p', content, css);
const muted = content => styled('span', content, 'dim');
const badge = content => styled('span', content, 'tag');
const strong = content => element('strong', content);
const link = (url, content, attributes = '') => element('a', content, ` href="${url}"${attributes}`);
const route = (kind, key) => `#/${kind}/${encodeURIComponent(key)}`;
const competitionRoute = key => route('bounty', key);
const accountRoute = key => route('profile', key);
const heading = (title, content) => element('h2', title) + content;
const breadcrumb = content => p(content, 'crumb');
const home = () => breadcrumb(link('#/', '&larr; All bounties'));
const placement = value => value == null ? '—' : '#' + num(value);
const row = values => element('tr', join(values, value => element('td', value)));
function grid(values, wide = false) {
  return styled('dl', join(values, ([label, value]) => element('dt', label) + element('dd', value)), wide ? 'facts facts-wide' : 'facts');
}
function table(labels, content, bodyId = '', css = '') {
  const header = element('thead', element('tr', join(labels, label => element('th', label, ' scope="col"'))));
  return styled('table', header + element('tbody', content, bodyId ? ` id="${bodyId}"` : ''), 'table' + (css ? ' ' + css : ''));
}
function pageRows(items, limit, prefix, labels, render, noun, css = '') {
  const count = Math.min(limit, items.length);
  const content = table(labels, join(items.slice(0, limit), render), prefix + '-body', css);
  const counter = element('p', `${num(count)} of ${num(items.length)} ${noun} shown.`, ` id="${prefix}-count"`);
  const next = items.length > limit ? p(element('button', 'Show more', ` type="button" id="${prefix}-more"`)) : '';
  return content + counter + next;
}
function sponsor(b) {
  return badge(esc(b.category || 'Bounty')) + ' ' + element('span', 'by ' + esc(b.sponsor?.name || 'make.fun'));
}
export function pot(b) { return money(b.potUsd ?? b.rewardAmount); }
export function fee(b) {
  if (b.entryFeeUsd == null || !(Number(b.entryFeeUsd) > 0)) return 'Free entry';
  return money(b.entryFeeUsd) + ' entry';
}
function select(id, choices) {
  return element('select', join(choices, ([value, label]) => element('option', label, ` value="${esc(value)}"`)), ` id="${id}"`);
}
export function boardShell(categories) {
  const categoryOptions = [['all', 'All categories'], ...categories.map(value => [value, esc(value)])];
  const sortOptions = [['deadline', 'Closing soon'], ['pot', 'Biggest pot'], ['entries', 'Most entries'], ['newest', 'Newest first'], ['title', 'Title A&ndash;Z']];
  const statuses = [['all', 'All'], ['open', 'Taking entries'], ['soon', 'Ending in 48h'], ['ended', 'Ended, awaiting results']];
  const radios = join(statuses, ([value, label]) => `<label><input type="radio" name="st" value="${value}"${value === 'all' ? ' checked' : ''}> ${label}</label>`);
  const controls = '<label>Search <input type="search" id="q" placeholder="Title, slug or skill&hellip;" autocomplete="off"></label>'
    + '<label>Category ' + select('cat', categoryOptions) + '</label><label>Sort by ' + select('sort', sortOptions) + '</label>'
    + element('fieldset', '<legend>Status</legend>' + radios, ' class="chips" id="status-chips"');
  return '<h1>Open bounties</h1>'
    + p('Live bounties on make.fun, with each one&rsquo;s live pot, entry fee, time left and entries. A bounty past its deadline takes no more entries, even while it still reads &ldquo;open&rdquo;.', 'lede')
    + element('form', controls, ' class="controls" id="board-controls" role="search" aria-label="Filter bounties"')
    + '<p id="board-count" aria-live="polite"></p><ul class="board" id="board-list"></ul>';
}
export function boardRow(b) {
  const url = competitionRoute(b.slug);
  const clock = hasEnded(b.deadline) ? styled('span', 'Entries closed', 'ended') : esc(timeLeft(b.deadline));
  const content = element('h2', link(url, esc(b.title))) + p(sponsor(b), 'meta')
    + grid([['Live pot', strong(pot(b))], ['Entry fee', fee(b)], ['Time left', clock], ['Entries', num(b.submissionCount)]])
    + p(link(url + '/leaderboard', 'Leaderboard') + ' &middot; ' + link(url, 'Details'), 'links');
  return styled('li', content, 'card');
}
function payoutSection(b) {
  const rows = [];
  if (Array.isArray(b.rewardsNow) && b.rewardsNow.length) {
    for (const reward of b.rewardsNow) rows.push([num(reward.place), money(reward.baseUsd), money(reward.feeShareUsd), strong(money(reward.amountUsd))]);
  } else if (b.rewards && typeof b.rewards === 'object') {
    for (const [place, amount] of Object.entries(b.rewards)) rows.push([num(place), money(amount), '—', strong(money(amount))]);
  }
  return rows.length ? heading('Payouts ' + muted('(live pot split)'), table(['Place', 'Base prize', 'Fee share', 'Total now'], join(rows, row))) : '';
}
export function bounty(b) {
  const ended = hasEnded(b.deadline);
  const paid = b.entryFeePayers ? ' ' + muted(`(${num(b.entryFeePayers)} entry fee${b.entryFeePayers === 1 ? '' : 's'} paid in)`) : '';
  const details = [['Live pot', strong(pot(b)) + paid], ['Entry fee', fee(b)], ['Deadline', date(b.deadline) + ` (${ended ? 'ended' : esc(timeLeft(b.deadline))})`]];
  if (b.opensAt) details.push(['Opens', date(b.opensAt)]);
  details.push(['Entries', num(b.submissionCount) + (b.submissionsPassed != null ? ` (${num(b.submissionsPassed)} passed)` : '')]);
  details.push(['Status', esc(b.status || '—') + (ended ? ' &middot; entries closed' : '')]);
  const opening = b.opensAt && !hasEnded(b.opensAt) ? ' ' + styled('span', 'Opens ' + date(b.opensAt), 'ended') : '';
  const parts = [home(), element('h1', esc(b.title)), p(esc(b.summary || ''), 'lede'), p(sponsor(b) + opening, 'meta'), grid(details, true),
    p(link(competitionRoute(b.slug) + '/leaderboard', 'View leaderboard', ' class="btn"'), 'actions'), payoutSection(b)];
  if (Array.isArray(b.skills) && b.skills.length) parts.push(heading('Skills', styled('ul', join(b.skills, skill => element('li', esc(skill))), 'tags')));
  if (b.description) parts.push(heading('Description', styled('div', esc(b.description), 'description')));
  if (b.rules) parts.push(element('details', '<summary>Rules</summary>' + styled('div', esc(b.rules), 'description')));
  if (b.resolution?.summary) parts.push(heading('How it is judged', p(esc(b.resolution.summary))));
  if (Array.isArray(b.notices) && b.notices.length) parts.push(heading('Notices', element('ul', join(b.notices, notice => element('li', esc(notice.title || notice.message || '') + (notice.createdAt ? ' ' + muted('(' + day(notice.createdAt) + ')') : ''))))));
  return parts.join('');
}
function scoreCell(entry, column) {
  const value = entry.values ? entry.values[column.key] : null;
  if (value == null) return '—';
  const source = column.source || '';
  for (const field of ['win_rate_micro', 'interval_low_micro', 'interval_high_micro']) {
    if (source.includes(field)) return microPct(value);
  }
  if (source.includes('net_pnl')) return microMoney(value);
  return column.key === 'bytes' ? num(value) : esc(entry.display?.[column.key] ?? String(value));
}
export function lbRow(entry, columns) {
  const range = entry.rank_range;
  const rangeText = range && range.best !== range.worst ? ` <span class="dim" title="Rank range">(${num(range.best)}–${num(range.worst)})</span>` : '';
  const kind = entry.house ? 'house' : entry.baseline ? 'baseline' : '';
  const account = link(accountRoute(entry.handle), esc(entry.handle)) + (kind ? ' ' + badge(kind) : '');
  return row([num(entry.rank) + rangeText, account, esc(entry.title || ''), ...columns.map(column => scoreCell(entry, column)), placement(entry.prize_rank)]);
}
export function leaderboard(slug, lb) {
  const title = esc(lb.competition?.title || slug);
  const columns = (lb.columns || []).filter(column => !column.hidden).sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  const entries = (lb.entries || []).concat(lb.rest || []);
  const parts = [breadcrumb(link(competitionRoute(slug), '&larr; ' + title) + ' &middot; ' + link('#/', 'All bounties')),
    element('h1', 'Leaderboard: ' + title),
    p(esc(lb.title || 'Results') + ' &middot; phase: ' + esc(lb.phase?.title || '—') + ' &middot; ranked by ' + esc(lb.rank_key || '—') + (lb.tie_break ? ', ties broken by ' + esc(lb.tie_break.title || lb.tie_break.key) : ''), 'lede')];
  if ((lb.views || []).length > 1) parts.push(p('View: ' + lb.views.map(view => view === lb.view ? strong(esc(view)) : link(competitionRoute(slug) + '/leaderboard?view=' + encodeURIComponent(view), esc(view))).join(' &middot; '), 'meta'));
  if (lb.phase?.placements_held && !entries.length) parts.push(p('Placements are held until the results are published, so no entries are listed yet.', 'note'));
  if (!lb.phase?.scores_visible) parts.push(p('Scores are not visible yet for this phase.', 'note'));
  parts.push(entries.length ? pageRows(entries, 25, 'lb', ['Rank', 'Account', 'Entry', ...columns.map(column => esc(column.title)), 'Prize place'], entry => lbRow(entry, columns), 'rows', 'leaderboard-table') : p('No entries on the board yet for this bounty.'));
  parts.push(p('Win rates are the judge&rsquo;s share of wins (90% interval shown where the board lists it). Rows are the API&rsquo;s own first page plus its stubs, shown 25 at a time.', 'dim'));
  return parts.join('');
}
export function solutionRow(solution) {
  const competition = solution.competition || {};
  const score = solution.score;
  const result = score ? esc(score.column?.title || 'Score') + ': ' + (score.column?.source?.includes('win_rate') ? microPct(score.value) : esc(score.display ?? String(score.value ?? ''))) : '—';
  return row([esc(solution.title || ''), link(competitionRoute(competition.slug), esc(competition.title || competition.slug || '')), placement(solution.placement), solution.prize_usd != null ? money(solution.prize_usd) : '—', result, day(solution.entered_at)]);
}
function profileIdentity(handle, data) {
  const picture = data.image || data.avatar;
  const avatar = picture ? `<img class="avatar" src="${esc(picture.startsWith('http') ? picture : 'https://make.fun' + picture)}" alt="Avatar of ${esc(handle)}" width="72" height="72" crossorigin="anonymous">`
    : element('span', esc(handle.slice(0, 1).toUpperCase()), ' class="avatar avatar-fallback" aria-hidden="true"');
  const links = [];
  const outside = (url, label) => link(esc(url), label, ' rel="noopener"');
  if (data.github_login) links.push(outside('https://github.com/' + encodeURIComponent(data.github_login), 'GitHub: ' + esc(data.github_login)));
  if (data.discord?.url) links.push(outside(data.discord.url, 'Discord: ' + esc(data.discord.username || data.discord.global_name || 'Discord')));
  if (data.wallet?.explorer_url) links.push(outside(data.wallet.explorer_url, 'Wallet: ' + esc(shortAddr(data.wallet.address))));
  const content = element('h1', esc(data.display_name || handle)) + p('@' + esc(handle) + (data.house ? ' ' + badge('house') : '') + ' &middot; joined ' + day(data.joined_at), 'meta')
    + (data.bio ? p(esc(data.bio)) : '') + (links.length ? p(links.join(' &middot; '), 'links') : '');
  return styled('div', avatar + element('div', content), 'profile-head');
}
export function profile(handle, data, movedFrom) {
  const record = data.record || {};
  const entries = Array.isArray(data.solutions) ? data.solutions : [];
  const moved = movedFrom && movedFrom !== handle ? p('This handle moved: ' + link(accountRoute(handle), '@' + esc(handle)) + ' is the current one.', 'note') : '';
  const stats = [['Competitions entered', strong(num(record.competitions_entered))], ['Placed', num(record.competitions_placed)], ['Won', num(record.competitions_won)], ['Podium finishes', num(record.podium_finishes)], ['Best placement', placement(record.best_placement)], ['Prize money paid', strong(money(record.prize_usd))]];
  const publicEntries = entries.length ? pageRows(entries, 10, 'sol', ['Entry', 'Competition', 'Place', 'Prize', 'Score', 'Entered'], solutionRow, 'entries') : p('No public entries yet.');
  return home() + moved + profileIdentity(handle, data) + grid(stats, true) + heading('Entries ' + muted('(' + num(entries.length) + ' public)'), publicEntries);
}
function failurePage(title, message) {
  return element('h1', title) + p(esc(message)) + p(link('#/', 'Back to the board'));
}
export function errorView(message) { return failurePage('Something went wrong', message); }
export function notFoundView(message) { return failurePage('Not found', message); }
