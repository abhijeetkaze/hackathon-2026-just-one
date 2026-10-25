// Picking today's one thing. Deterministic, so the same list always gives the same answer and every
// pick can be explained in one line. The model never ranks anything.

import { daysBetween, describeDue } from "./dates.js";

/** Words in "what happens if you skip it" that mean money, a cutoff, or something lost. */
const HARD = /\b(fine|penalt|late fee|fee|interest|charge|lose|lost|expire|expiry|lapse|cancel|cut ?off|disconnect|block|suspend|miss(ed)? (the )?(deadline|flight|train|bus|exam)|refund|deadline|legal|notice|court|tax|insurance|renew)/i;

let counter = 0;
export function newId() {
  counter += 1;
  return `t${Date.now().toString(36)}${counter.toString(36)}`;
}

/** { id, title, due, waiting, cost, minutes, skips, added, done } with safe defaults. */
export function makeTask(fields, today) {
  return {
    id: fields.id ?? newId(),
    title: String(fields.title ?? "").trim(),
    due: fields.due ?? "",
    waiting: String(fields.waiting ?? "").trim(),
    cost: String(fields.cost ?? "").trim(),
    minutes: Number(fields.minutes) > 0 ? Math.min(Math.round(Number(fields.minutes)), 600) : 0,
    skips: fields.skips ?? 0,
    added: fields.added ?? today,
    done: fields.done ?? "",
    step: fields.step ?? "",
    skipped: fields.skipped ?? "",
  };
}

/** The score and the reasons behind it. Higher goes first. */
export function score(task, today) {
  const reasons = [];
  let s = 0;
  if (task.due) {
    const n = daysBetween(today, task.due);
    if (n < 0) s += 100 + 5 * Math.min(-n, 10);
    else if (n === 0) s += 90;
    else if (n === 1) s += 70;
    else if (n <= 3) s += 50;
    else if (n <= 7) s += 30;
    else s += 10;
    reasons.push(n < 0 ? `it's ${describeDue(task.due, today)}` : `it's due ${describeDue(task.due, today)}`);
  } else {
    s += 5;
  }
  if (task.waiting) {
    s += 25;
    reasons.push(`${task.waiting} is waiting on it`);
  }
  if (task.cost && HARD.test(task.cost)) {
    s += 20;
    reasons.push(`skipping it means ${task.cost}`);
  }
  if (task.skips > 0) {
    s += 8 * task.skips;
    reasons.push(task.skips === 1 ? "you skipped it once already" : `you've skipped it ${task.skips} times`);
  }
  if (task.minutes && task.minutes <= 15) {
    s += 5;
    reasons.push(`it only takes about ${task.minutes} minutes`);
  }
  return { score: s, reasons };
}

/** Open tasks, best first. Ties go to the one you added earliest. */
export function rank(tasks, today) {
  return tasks
    .filter((t) => !t.done)
    .map((t) => ({ task: t, ...score(t, today) }))
    .sort((a, b) => b.score - a.score || a.task.added.localeCompare(b.task.added) || a.task.id.localeCompare(b.task.id));
}

/** "Do this because it's due tomorrow and Priya is waiting on it." */
export function because(reasons) {
  if (!reasons.length) return "Nothing on your list is urgent, so this is the oldest thing on it.";
  if (reasons.length === 1) return `Because ${reasons[0]}.`;
  return `Because ${reasons.slice(0, -1).join(", ")} and ${reasons.at(-1)}.`;
}

/**
 * Today's pick. Once chosen it stays put for the day (`state.today` = { date, id }), so opening
 * the app again doesn't reshuffle. A new pick happens on a new day, or after done / not today.
 */
export function todaysPick(state, today) {
  const open = rank(state.tasks, today);
  if (!open.length) return null;
  if (state.today?.date === today) {
    const kept = open.find((r) => r.task.id === state.today.id);
    if (kept) return kept;
    if (state.today.id === null) return null; // done for today, resting
  }
  return open[0];
}

export function markDone(state, id, today) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: today } : t)),
    today: { date: today, id: null },
  };
}

/** "Not today": it'll come back heavier tomorrow. Today, nothing else is forced on you. */
export function skip(state, id, today) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, skips: t.skips + 1, skipped: today } : t)),
    today: { date: today, id: null },
  };
}

/** "Give me another" after done/skip: the next best, never the one you just said no to. */
export function another(state, today) {
  const next = rank(state.tasks, today).find((r) => r.task.skipped !== today);
  return { ...state, today: { date: today, id: next ? next.task.id : null } };
}

export function pin(state, pick, today) {
  return pick ? { ...state, today: { date: today, id: pick.task.id } } : state;
}

/** Drops duplicates when the same brain dump is pasted twice. */
export function addTasks(state, newTasks) {
  const seen = new Set(state.tasks.filter((t) => !t.done).map((t) => t.title.toLowerCase()));
  const fresh = newTasks.filter((t) => t.title && !seen.has(t.title.toLowerCase()));
  return { ...state, tasks: [...state.tasks, ...fresh], added: fresh.length };
}
