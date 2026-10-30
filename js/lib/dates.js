export const TIME_ZONE = 'America/Recife';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const toTime = (value) => (value instanceof Date ? value.getTime() : new Date(value).getTime());

export function nextExam(provas, now = new Date()) {
  const t = toTime(now);
  let best = null;
  for (const prova of provas ?? []) {
    const start = toTime(prova.inicio);
    if (Number.isNaN(start) || start <= t) continue;
    if (!best || start < toTime(best.inicio)) best = prova;
  }
  return best;
}

export function countdownParts(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 60000) || 0);
  return {
    days: Math.floor(total / 1440),
    hours: Math.floor((total % 1440) / 60),
    minutes: total % 60,
  };
}

// weeklyPace - topicos por semana; com menos de uma semana, conta como uma
export function weeklyPace(remaining, until, now = new Date()) {
  if (remaining <= 0) return 0;
  const left = toTime(until) - toTime(now);
  if (!(left > 0)) return null;
  return Math.ceil(remaining / Math.max(left / WEEK, 1));
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});

const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
});

const keyFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
});

export function formatDate(iso) {
  return dateFmt.format(new Date(iso));
}

export function formatTime(iso) {
  const parts = timeFmt.formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}h${get('minute')}`;
}

// dayNumber - numero do dia de calendario no fuso de recife
function dayNumber(value) {
  const [y, m, d] = keyFmt.format(new Date(value)).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

export function relativeDay(iso, now = new Date()) {
  const diff = dayNumber(now) - dayNumber(iso);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff > 1 && diff <= 6) return `há ${diff} dias`;
  return formatDate(iso);
}

// calendarDays - dias de calendário (fuso de recife) de now até iso; negativo se já passou
export function calendarDays(iso, now = new Date()) {
  return dayNumber(iso) - dayNumber(now);
}

// examStatus - situação de uma prova: "em N dias", "amanhã", "hoje", "em andamento" ou "realizada"
export function examStatus(inicio, now = new Date()) {
  const days = calendarDays(inicio, now);
  if (days < 0) return { phase: 'done', days, text: 'realizada' };
  if (days === 0) {
    return toTime(inicio) <= toTime(now)
      ? { phase: 'ongoing', days, text: 'em andamento' }
      : { phase: 'today', days, text: 'hoje' };
  }
  return { phase: 'upcoming', days, text: days === 1 ? 'amanhã' : `em ${days} dias` };
}
