const missing = '—';
const numeric = (input, render) => {
  const value = Number(input);
  return Number.isFinite(value) ? render(value) : missing;
};
const localize = (value, options) => value.toLocaleString('en-US', options);
function calendar(input, includeTime) {
  if (!input) return missing;
  const options = {timeZone: 'UTC', dateStyle: 'medium'};
  if (includeTime) options.timeStyle = 'short';
  return localize(new Date(input), options);
}
export function esc(input) {
  return String(input ?? '').replace(/[&<>"']/g, character => '&#' + character.charCodeAt(0) + ';');
}
export function num(input) { return numeric(input, value => localize(value)); }
export function money(input) {
  return numeric(input, value => localize(value, {
    currency: 'USD', style: 'currency', minimumFractionDigits: value % 1 ? 2 : 0,
  }));
}
export function microMoney(input) { return numeric(input, value => money(value / 1e6)); }
export function microPct(input) { return numeric(input, value => (value / 1e4).toFixed(2) + '%'); }
export function day(input) { return calendar(input, false); }
export function date(input) { return input ? calendar(input, true) + ' UTC' : missing; }
export function hasEnded(input) { return !input || Date.now() >= new Date(input).getTime(); }
export function shortAddr(input) {
  const address = String(input ?? '');
  return address.length > 12 ? address.substring(0, 6) + '…' + address.substring(address.length - 4) : address;
}
export function timeLeft(input) {
  const remaining = new Date(input).getTime() - Date.now();
  if (remaining <= 0) return 'ended';
  const minutes = Math.floor(remaining % 3600000 / 60000);
  const hours = Math.floor(remaining % 86400000 / 3600000);
  const days = Math.floor(remaining / 86400000);
  if (days) return days + 'd ' + hours + 'h left';
  if (hours) return hours + 'h ' + minutes + 'm left';
  return minutes + 'm left';
}
