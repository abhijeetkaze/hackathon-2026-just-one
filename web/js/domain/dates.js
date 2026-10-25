// Turning "by Friday", "tomorrow", "end of month", "30th" into a date, relative to today.
// Pure: every function takes today as "YYYY-MM-DD", so tests don't depend on the clock.

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(today, n) {
  const d = parts(today);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** Whole days from `today` to `date` (negative when it's in the past). */
export function daysBetween(today, date) {
  return Math.round((parts(date) - parts(today)) / 86400000);
}

/** Local "YYYY-MM-DD" for a JS Date (the phone's own timezone). */
export function localISO(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function nextWeekday(today, target, skipThisWeek) {
  const dow = parts(today).getUTCDay();
  let ahead = (target - dow + 7) % 7;
  if (skipThisWeek) ahead += 7;
  return addDays(today, ahead);
}

/** The next occurrence of day-of-month `day` (this month if it hasn't passed, else next month). */
function nextDayOfMonth(today, day, month = null) {
  const t = parts(today);
  let y = t.getUTCFullYear();
  let m = month ?? t.getUTCMonth();
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(y, m, day));
    if (d.getUTCMonth() === m && iso(d) >= today) return iso(d);
    if (month !== null) {
      y += 1; // a named month that's already gone means next year
    } else {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }
  return "";
}

/**
 * A deadline phrase → "YYYY-MM-DD", or "" when there isn't one or it can't be read.
 * Reads: today, tonight, tomorrow, day after tomorrow, this weekend, next week, (by/next) Friday,
 * in 3 days, in 2 weeks, end of month/week, 30th, 30 Oct, Oct 30, 30/10, 2026-10-30.
 */
export function parseDue(raw, today) {
  const s = String(raw ?? "").toLowerCase().replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/\b(today|tonight|eod|end of (the )?day|asap|urgent|now)\b/.test(s)) return today;
  if (/\bday after tomorrow\b/.test(s)) return addDays(today, 2);
  if (/\b(tomorrow|tmrw|tmr)\b/.test(s)) return addDays(today, 1);
  if (/\bweekend\b/.test(s)) return parts(today).getUTCDay() === 0 ? today : nextWeekday(today, 6, false);
  if (/\bend of (the )?week\b|\bthis week\b/.test(s)) return nextWeekday(today, 5, false);
  if (/\bnext week\b/.test(s)) return nextWeekday(addDays(today, 1), 1, false);
  if (/\b(end of (the )?month|month end|month-end)\b/.test(s)) {
    const t = parts(today);
    return iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)));
  }
  let m = /\bin (\d+|a|one|two|three) (day|days|week|weeks)\b/.exec(s);
  if (m) {
    const n = { a: 1, one: 1, two: 2, three: 3 }[m[1]] ?? Number(m[1]);
    return addDays(today, m[2].startsWith("week") ? n * 7 : n);
  }
  m = /\b(next )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|rsday|urday|sday)?\b/.exec(s);
  if (m) {
    const idx = DAYS.findIndex((d) => d.startsWith(m[2].slice(0, 3)));
    return nextWeekday(today, idx, Boolean(m[1]));
  }
  m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s);
  if (m) return valid(+m[1], +m[2] - 1, +m[3]);
  m = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(s); // day first
  if (m) {
    if (m[3]) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    return nextDayOfMonth(today, +m[1], +m[2] - 1);
  }
  m = /\b(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]{3,})\b/.exec(s);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return nextDayOfMonth(today, +m[1], MONTHS.indexOf(m[2].slice(0, 3)));
  m = /\b([a-z]{3,}) (\d{1,2})(?:st|nd|rd|th)?\b/.exec(s);
  if (m && MONTHS.includes(m[1].slice(0, 3))) return nextDayOfMonth(today, +m[2], MONTHS.indexOf(m[1].slice(0, 3)));
  m = /\b(\d{1,2})(st|nd|rd|th)\b/.exec(s);
  if (m) return nextDayOfMonth(today, +m[1]);
  return "";
}

function valid(y, mo, d) {
  const date = new Date(Date.UTC(y, mo, d));
  return date.getUTCMonth() === mo && date.getUTCDate() === d ? iso(date) : "";
}

/** "today", "tomorrow", "in 3 days", "2 days late", "Fri 30 Oct". */
export function describeDue(due, today) {
  if (!due) return "";
  const n = daysBetween(today, due);
  if (n < 0) return n === -1 ? "1 day late" : `${-n} days late`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n < 7) return `in ${n} days`;
  const d = parts(due);
  const cap = (w) => w[0].toUpperCase() + w.slice(1, 3);
  return `${cap(DAYS[d.getUTCDay()])} ${d.getUTCDate()} ${cap(MONTHS[d.getUTCMonth()])}`;
}
