// Brain dump → tasks. Gemma on the phone splits the messy text and copies what it finds; code reads
// the dates and does all the ranking. Without a model, one line = one task and dates are still read.

import { parseDue } from "./dates.js";
import { makeTask } from "./tasks.js";

export function buildSplitPrompt(text) {
  return [
    "Below is someone's brain dump of everything they need to do. Split it into separate tasks.",
    "Reply with ONLY a JSON array. One object per task, with these keys:",
    '  "title": the task as a short instruction, under 10 words (e.g. "Pay the electricity bill")',
    '  "due": the deadline words copied exactly as written (e.g. "by Friday", "tomorrow", "30th"), or ""',
    '  "waiting": who is waiting on it, if someone is (e.g. "Priya", "my landlord"), or ""',
    '  "cost": what happens if it is skipped, copied from the text (e.g. "late fee"), or ""',
    '  "minutes": a rough guess of how many minutes it takes, as a number',
    "Do not invent deadlines, people or consequences that are not in the text. Do not merge tasks.",
    "",
    "Brain dump:",
    String(text).trim(),
  ].join("\n");
}

export function buildStepPrompt(task) {
  return [
    `Task: "${task.title}"`,
    task.cost ? `If it's skipped: ${task.cost}` : "",
    "This person is putting it off because it feels too big.",
    "Reply with ONE sentence: the smallest first step they could do in under 5 minutes, starting with a verb.",
    "No preamble, no list, no encouragement. Just the step.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** First JSON array (or {"tasks": [...]}) in a reply; fences, chatter and trailing commas tolerated. */
export function parseTaskJson(reply) {
  const s = String(reply ?? "");
  const tryParse = (body) => {
    try {
      return JSON.parse(body);
    } catch {
      try {
        return JSON.parse(body.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        return undefined;
      }
    }
  };
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  if (a >= 0 && b > a) {
    const arr = tryParse(s.slice(a, b + 1));
    if (Array.isArray(arr)) return arr;
  }
  const o = s.indexOf("{");
  const c = s.lastIndexOf("}");
  if (o >= 0 && c > o) {
    const obj = tryParse(s.slice(o, c + 1));
    if (Array.isArray(obj?.tasks)) return obj.tasks;
    if (obj && typeof obj === "object" && obj.title) return [obj];
  }
  throw new Error("Gemma's answer wasn't a list of tasks.");
}

const NONE = /^(none|n\/?a|null|nobody|no one|unknown|-|not mentioned)$/i;
const clean = (v) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return NONE.test(s) ? "" : s;
};

/**
 * Model output → tasks. Deadlines are only kept if the words appear in the original dump, so a
 * deadline the model made up is dropped rather than trusted.
 */
export function toTasks(items, dump, today) {
  const source = String(dump ?? "").toLowerCase();
  return items
    .map((it) => {
      const dueWords = clean(it?.due);
      const due = dueWords && source.includes(dueWords.toLowerCase()) ? parseDue(dueWords, today) : "";
      const waiting = clean(it?.waiting);
      return makeTask(
        {
          title: clean(it?.title).replace(/[.]+$/, ""),
          due,
          waiting: waiting && source.includes(waiting.toLowerCase()) ? waiting : "",
          cost: clean(it?.cost),
          minutes: it?.minutes,
        },
        today,
      );
    })
    .filter((t) => t.title);
}

/** No model: each non-empty line (or bullet) is a task, and its deadline words are read by code. */
export function splitByLines(dump, today) {
  return String(dump ?? "")
    .split(/\n|;/)
    .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 1)
    .map((line) => makeTask({ title: line.slice(0, 120), due: parseDue(line, today) }, today));
}

/** One clean sentence from the "first step" reply. */
export function cleanStep(reply) {
  const s = String(reply ?? "")
    .trim()
    .split(/\n/)[0]
    .replace(/^["'\s*-]+|["'\s]+$/g, "")
    .trim();
  return s.length > 200 ? s.slice(0, 197) + "…" : s;
}

/** Picks the on-device Gemma build: Gemma 2 2B, f16 when the GPU supports it. */
export function pickGemmaModel(availableIds, { supportsF16 }) {
  const ids = new Set(availableIds);
  const preferred = supportsF16 ? ["gemma-2-2b-it-q4f16_1-MLC", "gemma-2-2b-it-q4f32_1-MLC"] : ["gemma-2-2b-it-q4f32_1-MLC"];
  return preferred.find((id) => ids.has(id)) ?? null;
}
