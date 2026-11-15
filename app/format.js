// Display conversions shared by the route renderers.
const missing = '—';
const numeric = (input, render) => {
  const value = Number(input);
  return Number.isFinite(value) ? render(value) : missing;
};
const utc = (input, options) => input
  ? new Date(input).toLocaleString('en-US', { ...options, timeZone: 'UTC' })
  : missing;

export const esc = (input) => String(input ?? '').replace(/[&<>"']/g,
  character => '&#' + character.charCodeAt(0) + ';');
export const num = (input) => numeric(input, value => value.toLocaleString('en-US'));
export const money = (input) => numeric(input, value => value.toLocaleString('en-US', {
  currency: 'USD', style: 'currency', minimumFractionDigits: value % 1 === 0 ? 0 : 2,
}));
export const microPct = (input) => numeric(input, value => (value / 1e4).toFixed(2) + '%');
export const microMoney = (input) => numeric(input, value => money(value / 1e6));
export const day = (input) => utc(input, { dateStyle: 'medium' });
export const date = (input) => input
  ? utc(input, { dateStyle: 'medium', timeStyle: 'short' }) + ' UTC' : missing;
export const hasEnded = (input) => !input || Number(new Date(input)) <= Date.now();
export function shortAddr(input) {
  const address = String(input ?? '');
  return address.length <= 12 ? address : address.substring(0, 6) + '…' + address.slice(-4);
}
export function timeLeft(input) {
  const remaining = new Date(input).getTime() - Date.now();
  if (remaining <= 0) return 'ended';
  const units = [86400000, 3600000, 60000];
  const parts = units.map((unit, index) => Math.floor(
    (index ? remaining % units[index - 1] : remaining) / unit));
  if (parts[0] > 0) return parts[0] + 'd ' + parts[1] + 'h left';
  if (parts[1] > 0) return parts[1] + 'h ' + parts[2] + 'm left';
  return parts[2] + 'm left';
}
