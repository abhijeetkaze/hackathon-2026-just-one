import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { addDays, daysBetween, describeDue, parseDue } from "../web/js/domain/dates.js";
import { buildSplitPrompt, cleanStep, parseTaskJson, pickGemmaModel, splitByLines, toTasks } from "../web/js/domain/extract.js";
import { addTasks, another, because, makeTask, markDone, pin, rank, score, skip, todaysPick } from "../web/js/domain/tasks.js";

const TODAY = "2026-10-25"; // a Sunday

test("parseDue reads the ways people write deadlines", () => {
  const cases = {
    today: TODAY,
    tonight: TODAY,
    tomorrow: "2026-10-26",
    "day after tomorrow": "2026-10-27",
    "by Friday": "2026-10-30",
    fri: "2026-10-30",
    "next Friday": "2026-11-06",
    "this weekend": TODAY,
    "next week": "2026-10-26",
    "end of month": "2026-10-31",
    "in 3 days": "2026-10-28",
    "in two weeks": "2026-11-08",
    "30th": "2026-10-30",
    "5th": "2026-11-05",
    "3 Nov": "2026-11-03",
    "Nov 3rd": "2026-11-03",
    "30/10": "2026-10-30",
    "01/02/2027": "2027-02-01",
    "2026-12-01": "2026-12-01",
    "2 Jan": "2027-01-02",
  };
  for (const [words, want] of Object.entries(cases)) assert.equal(parseDue(words, TODAY), want, words);
});

test("parseDue refuses what isn't a deadline", () => {
  for (const s of ["", "sometime", "when I feel like it", "31/02/2027", "the 3 of us"]) assert.equal(parseDue(s, TODAY), "", s);
});

test("date helpers", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(daysBetween(TODAY, "2026-10-23"), -2);
  assert.equal(describeDue("2026-10-23", TODAY), "2 days late");
  assert.equal(describeDue(TODAY, TODAY), "today");
  assert.equal(describeDue("2026-10-26", TODAY), "tomorrow");
  assert.equal(describeDue("2026-11-05", TODAY), "Thu 5 Nov");
});

const t = (fields) => makeTask({ added: "2026-10-01", ...fields }, TODAY);

test("overdue beats due today beats due later beats no deadline", () => {
  const order = rank([t({ id: "a", title: "someday" }), t({ id: "b", title: "later", due: "2026-11-20" }), t({ id: "c", title: "today", due: TODAY }), t({ id: "d", title: "late", due: "2026-10-20" })], TODAY);
  assert.deepEqual(order.map((r) => r.task.id), ["d", "c", "b", "a"]);
});

test("someone waiting and a real cost push a task up, and the reasons say so", () => {
  const plain = score(t({ title: "x", due: "2026-10-28" }), TODAY);
  const waited = score(t({ title: "x", due: "2026-10-28", waiting: "Priya", cost: "late fee of ₹500" }), TODAY);
  assert.equal(waited.score - plain.score, 45);
  assert.deepEqual(waited.reasons, ["it's due in 3 days", "Priya is waiting on it", "skipping it means late fee of ₹500"]);
  assert.equal(score(t({ title: "x", cost: "mild guilt" }), TODAY).reasons.length, 0);
});

test("skipping makes a task heavier every time", () => {
  const a = score(t({ title: "x", skips: 0 }), TODAY).score;
  const b = score(t({ title: "x", skips: 3 }), TODAY).score;
  assert.equal(b - a, 24);
});

test("because() reads like a sentence", () => {
  assert.equal(because(["it's due today"]), "Because it's due today.");
  assert.equal(because(["a", "b", "c"]), "Because a, b and c.");
  assert.match(because([]), /oldest thing/);
});

test("today's pick stays put for the day, then done/skip leaves you alone", () => {
  let state = { tasks: [t({ id: "a", title: "A", due: TODAY }), t({ id: "b", title: "B", due: "2026-10-26" })], today: null };
  const first = todaysPick(state, TODAY);
  assert.equal(first.task.id, "a");
  state = pin(state, first, TODAY);
  // a more urgent task added later doesn't reshuffle today
  state = addTasks(state, [t({ id: "c", title: "C", due: "2026-10-20" })]);
  assert.equal(todaysPick(state, TODAY).task.id, "a");
  // done → nothing more today unless asked
  state = markDone(state, "a", TODAY);
  assert.equal(todaysPick(state, TODAY), null);
  state = another(state, TODAY);
  assert.equal(todaysPick(state, TODAY).task.id, "c");
  // tomorrow is a fresh pick
  assert.equal(todaysPick(state, "2026-10-26").task.id, "c");
});

test("not today: no replacement forced, and the task comes back heavier", () => {
  let state = { tasks: [t({ id: "a", title: "A" }), t({ id: "b", title: "B" })], today: null };
  state = skip(state, "a", TODAY);
  assert.equal(todaysPick(state, TODAY), null);
  assert.equal(state.tasks[0].skips, 1);
  assert.equal(todaysPick(state, "2026-10-26").task.id, "a");
  // "give me another" after skipping never hands back the one you skipped
  assert.equal(another(state, TODAY).today.id, "b");
  assert.equal(another(skip(state, "b", TODAY), TODAY).today.id, null);
});

test("addTasks skips exact duplicates of open tasks", () => {
  const state = addTasks({ tasks: [t({ title: "Pay rent" })] }, [t({ title: "pay rent" }), t({ title: "Call Amma" })]);
  assert.equal(state.tasks.length, 2);
  assert.equal(state.added, 1);
});

const DUMP = `need to pay electricity bill by friday or there's a late fee
priya is waiting for the design review, said tomorrow
renew passport sometime
call the plumber`;

test("buildSplitPrompt carries the dump", () => {
  const p = buildSplitPrompt(`  ${DUMP}  `);
  assert.ok(p.includes('"waiting"') && p.endsWith("call the plumber"));
});

test("parseTaskJson tolerates fences, chatter, wrappers and trailing commas", () => {
  assert.deepEqual(parseTaskJson('Here you go:\n```json\n[{"title":"A",},]\n```'), [{ title: "A" }]);
  assert.deepEqual(parseTaskJson('{"tasks":[{"title":"A"}]}'), [{ title: "A" }]);
  assert.deepEqual(parseTaskJson('{"title":"A"}'), [{ title: "A" }]);
  assert.throws(() => parseTaskJson("I can't"), /wasn't a list/);
});

test("toTasks reads dates in code and drops anything the model made up", () => {
  const tasks = toTasks(
    [
      { title: "Pay the electricity bill.", due: "by friday", cost: "late fee", minutes: 10 },
      { title: "Send Priya the design review", due: "tomorrow", waiting: "Priya", minutes: "45" },
      { title: "Renew passport", due: "next month", waiting: "the embassy", cost: "none" },
      { title: "  ", due: "today" },
    ],
    DUMP,
    TODAY,
  );
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].title, "Pay the electricity bill");
  assert.equal(tasks[0].due, "2026-10-30");
  assert.equal(tasks[1].waiting, "Priya");
  assert.equal(tasks[1].minutes, 45);
  assert.equal(tasks[2].due, ""); // "next month" isn't in the dump
  assert.equal(tasks[2].waiting, ""); // nor is "the embassy"
  assert.equal(tasks[2].cost, "");
});

test("without a model, each line is a task and its deadline is still read", () => {
  const tasks = splitByLines(`- pay rent by 1st\n2) call the plumber\n\n• book tickets tomorrow`, TODAY);
  assert.deepEqual(tasks.map((x) => [x.title, x.due]), [["pay rent by 1st", "2026-11-01"], ["call the plumber", ""], ["book tickets tomorrow", "2026-10-26"]]);
});

test("cleanStep keeps one tidy sentence", () => {
  assert.equal(cleanStep('"Open the electricity board website and find the bill."\nYou got this!'), "Open the electricity board website and find the bill.");
});

test("pickGemmaModel", () => {
  const ids = ["gemma-2-2b-it-q4f16_1-MLC", "gemma-2-2b-it-q4f32_1-MLC"];
  assert.equal(pickGemmaModel(ids, { supportsF16: true }), "gemma-2-2b-it-q4f16_1-MLC");
  assert.equal(pickGemmaModel(ids, { supportsF16: false }), "gemma-2-2b-it-q4f32_1-MLC");
  assert.equal(pickGemmaModel([], { supportsF16: true }), null);
});

test("the service worker precaches every app file, and nothing that doesn't exist", () => {
  const web = new URL("../web/", import.meta.url).pathname;
  const sw = readFileSync(join(web, "sw.js"), "utf8");
  const listed = [...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  for (const f of listed) assert.ok(existsSync(join(web, f)), `sw.js lists missing ${f}`);
  const walk = (d) => readdirSync(join(web, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  for (const f of walk("js")) assert.ok(listed.includes(f), `sw.js doesn't precache ${f}`);
});
