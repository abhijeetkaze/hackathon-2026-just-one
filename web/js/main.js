// Wiring: three screens (Today, Add, Everything), the on-device model, and local storage.

import { describeDue, localISO } from "./domain/dates.js";
import { buildSplitPrompt, buildStepPrompt, cleanStep, parseTaskJson, splitByLines, toTasks } from "./domain/extract.js";
import { addTasks, another, because, markDone, pin, rank, skip, todaysPick } from "./domain/tasks.js";
import { gemma, unsupportedReason } from "./adapters/gemma.js";
import { clearAll, load, save } from "./adapters/store.js";

const EXAMPLE = `need to pay the electricity bill by friday or there's a late fee. priya is waiting on the design review, I told her tomorrow. renew my passport sometime. call the plumber about the kitchen tap. return the amazon parcel in 3 days or I lose the refund. book dentist appointment. reply to the society secretary about parking`;

const $ = (id) => document.getElementById(id);
const model = gemma();
let state = load();
const today = () => localISO();

// ── screens ──────────────────────────────────────────────────────────────────

function show(name) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== name;
  if (name === "today") renderToday();
  if (name === "all") renderAll();
  if (name === "dump") $("dumpText").focus();
  window.scrollTo(0, 0);
}

function commit(next) {
  state = next;
  save(state);
}

function renderToday() {
  const d = today();
  $("dateLine").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const open = state.tasks.filter((t) => !t.done);
  const pick = todaysPick(state, d);
  $("emptyCard").hidden = open.length > 0;
  $("pickCard").hidden = !pick;
  $("restCard").hidden = Boolean(pick) || open.length === 0;
  if (pick) {
    if (state.today?.date !== d || state.today?.id !== pick.task.id) commit(pin(state, pick, d));
    $("pickTitle").textContent = pick.task.title;
    $("pickWhy").textContent = because(pick.reasons);
    $("pickStep").hidden = !pick.task.step;
    $("pickStep").textContent = pick.task.step ? `Start here: ${pick.task.step}` : "";
    $("pickStatus").textContent = "";
  } else if (open.length) {
    const doneToday = state.tasks.some((t) => t.done === d);
    $("restEyebrow").textContent = doneToday ? "Done for today" : "Skipped for today";
    $("restTitle").textContent = doneToday ? "That was the one. You can stop now." : "Fine. It'll be here tomorrow.";
    const left = open.filter((t) => t.skipped !== d).length;
    $("restText").textContent = `${open.length} ${open.length === 1 ? "thing waits" : "things wait"} until tomorrow. You don't have to look at ${open.length === 1 ? "it" : "them"}.`;
    $("anotherBtn").hidden = left === 0;
  }
}

function renderAll() {
  const d = today();
  const list = $("allList");
  list.textContent = "";
  for (const r of rank(state.tasks, d)) {
    const li = document.createElement("li");
    const title = document.createElement("span");
    title.className = "t";
    title.textContent = r.task.title;
    const meta = document.createElement("span");
    meta.className = "m";
    meta.textContent = [r.task.due ? `due ${describeDue(r.task.due, d)}` : "", r.task.waiting ? `${r.task.waiting} waiting` : "", r.task.skips ? `skipped ${r.task.skips}×` : ""].filter(Boolean).join(" · ");
    const date = document.createElement("input");
    date.type = "date";
    date.value = r.task.due;
    date.setAttribute("aria-label", `Deadline for ${r.task.title}`);
    date.addEventListener("change", () => {
      commit({ ...state, tasks: state.tasks.map((t) => (t.id === r.task.id ? { ...t, due: date.value } : t)) });
      renderAll();
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "quiet";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      commit({ ...state, tasks: state.tasks.filter((t) => t.id !== r.task.id) });
      renderAll();
    });
    li.append(title, meta, date, del);
    list.append(li);
  }
  if (!list.children.length) list.innerHTML = '<li class="m">Nothing here. Lovely.</li>';
}

// ── adding ───────────────────────────────────────────────────────────────────

function dumpStatus(text, kind = "") {
  $("dumpStatus").textContent = text;
  $("dumpStatus").dataset.kind = kind;
}

function finishAdding(tasks, how) {
  const before = state.tasks.length;
  const next = addTasks(state, tasks);
  commit({ tasks: next.tasks, today: state.today });
  const added = state.tasks.length - before;
  $("dumpText").value = "";
  dumpStatus(`${added} ${added === 1 ? "task" : "tasks"} saved ${how}. Now forget about them.`, "ok");
  setTimeout(() => show("today"), 900);
}

async function sortWithGemma() {
  const text = $("dumpText").value.trim();
  if (!text) return dumpStatus("Write something first, or tap Example.", "warn");
  const reason = unsupportedReason();
  if (reason) return dumpStatus(`${reason} Use "One task per line" instead.`, "warn");
  const btn = $("splitBtn");
  btn.disabled = true;
  try {
    const cached = await model.isCached();
    dumpStatus(cached ? "Starting Gemma…" : "Downloading Gemma once (about 1.5 GB, use Wi-Fi). After this it works offline.");
    await model.load((p) => {
      $("dumpProgress").hidden = false;
      $("dumpProgress").value = p;
    });
    $("dumpProgress").hidden = true;
    dumpStatus("Gemma is sorting your list, on this phone…");
    const started = performance.now();
    const items = parseTaskJson(await model.complete(buildSplitPrompt(text)));
    const tasks = toTasks(items, text, today());
    if (!tasks.length) throw new Error("Gemma didn't find any tasks.");
    finishAdding(tasks, `in ${((performance.now() - started) / 1000).toFixed(1)}s, on this phone`);
  } catch (e) {
    $("dumpProgress").hidden = true;
    console.error(e);
    dumpStatus(`${e instanceof Error ? e.message : String(e)} Try "One task per line" instead.`, "warn");
  } finally {
    btn.disabled = false;
  }
}

function addByLines() {
  const text = $("dumpText").value.trim();
  if (!text) return dumpStatus("Write something first, or tap Example.", "warn");
  finishAdding(splitByLines(text, today()), "one per line");
}

// ── today's actions ──────────────────────────────────────────────────────────

async function makeSmaller() {
  const pick = todaysPick(state, today());
  if (!pick) return;
  const status = $("pickStatus");
  if (unsupportedReason()) {
    status.textContent = "This browser can't run Gemma. Try: open whatever this needs, and do the first two minutes of it.";
    return;
  }
  const btn = $("smallerBtn");
  btn.disabled = true;
  try {
    status.textContent = (await model.isCached()) ? "Thinking of a tiny first step…" : "Downloading Gemma once (about 1.5 GB)…";
    await model.load();
    const step = cleanStep(await model.complete(buildStepPrompt(pick.task), { maxTokens: 80 }));
    if (!step) throw new Error("No step came back.");
    commit({ ...state, tasks: state.tasks.map((t) => (t.id === pick.task.id ? { ...t, step } : t)) });
    renderToday();
  } catch (e) {
    status.textContent = `${e instanceof Error ? e.message : String(e)}`;
  } finally {
    btn.disabled = false;
  }
}

// ── start ────────────────────────────────────────────────────────────────────

for (const el of document.querySelectorAll("[data-go]")) el.addEventListener("click", () => show(el.dataset.go));
$("doneBtn").addEventListener("click", () => {
  const pick = todaysPick(state, today());
  if (pick) commit(markDone(state, pick.task.id, today()));
  renderToday();
});
$("skipBtn").addEventListener("click", () => {
  const pick = todaysPick(state, today());
  if (pick) commit(skip(state, pick.task.id, today()));
  renderToday();
});
$("anotherBtn").addEventListener("click", () => {
  commit(another(state, today()));
  renderToday();
});
$("smallerBtn").addEventListener("click", makeSmaller);
$("splitBtn").addEventListener("click", sortWithGemma);
$("linesBtn").addEventListener("click", addByLines);
$("exampleBtn").addEventListener("click", () => {
  $("dumpText").value = EXAMPLE;
  $("dumpText").focus();
});
$("clearBtn").addEventListener("click", () => {
  if (!confirm("Delete your whole list from this phone?")) return;
  clearAll();
  state = { tasks: [], today: null };
  show("today");
});
document.querySelector(".brand").addEventListener("click", () => show("today"));

show(state.tasks.length ? "today" : "dump");

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("Service worker not registered", e));
}
