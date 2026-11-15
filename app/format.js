const EMPTY = '—';
const finite = (value, fn) => Number.isFinite(Number(value)) ? fn(Number(value)) : EMPTY;
const utcText = (value, options) => value ? new Date(value).toLocaleString('en-US', {...options, timeZone:'UTC'}) : EMPTY;

export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
export const num = value => finite(value, n => n.toLocaleString('en-US'));
export const money = value => finite(value, n => n.toLocaleString('en-US', {style:'currency', currency:'USD', minimumFractionDigits:n % 1 ? 2 : 0}));
export const microPct = value => finite(value, n => `${(n / 10000).toFixed(2)}%`);
export const microMoney = value => finite(value, n => money(n / 1000000));
export const day = value => utcText(value, {dateStyle:'medium'});
export const date = value => value ? `${utcText(value, {dateStyle:'medium', timeStyle:'short'})} UTC` : EMPTY;
export const hasEnded = value => !value || new Date(value).getTime() <= Date.now();
export const shortAddr = value => { const s = String(value ?? ''); return s.length <= 12 ? s : `${s.slice(0,6)}…${s.slice(-4)}`; };
export const timeLeft = value => {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000), hours = Math.floor(ms % 86400000 / 3600000), mins = Math.floor(ms % 3600000 / 60000);
  return days ? `${days}d ${hours}h left` : hours ? `${hours}h ${mins}m left` : `${mins}m left`;
};
