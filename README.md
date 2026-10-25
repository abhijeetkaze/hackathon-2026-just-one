# Just One

*Dump your whole to-do list once. Every day it shows you just one thing.*

Everything you've been putting off goes into one text box, once, as messy as you like.
**Gemma, running on your phone**, splits it into tasks. After that the app has one screen: today's
one thing, why it's that one, and three buttons: **Done**, **Too big? Make it smaller**, **Not today**.
Your list never leaves the phone.

**Live:** [just-one-s6f8.onrender.com](https://just-one-s6f8.onrender.com)

Built for the [DEV Hacktoberfest 2026 Open-Source AI Challenge, Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).
This folder was started on **2026-10-25**.

## How it works

| Step | What happens | Who does it |
| --- | --- | --- |
| Dump | One messy paragraph of everything | you, once |
| Split | Into tasks: title, deadline words, who's waiting, what skipping costs, rough minutes | **Gemma 2 2B** on the phone (WebLLM) |
| Read dates | "by Friday", "in 3 days", "30th", "end of month" → a real date | code (`dates.js`) |
| Pick | One task for today, with the reason in one sentence | code (`tasks.js`) |
| Too big? | One first step you can do in under 5 minutes | Gemma |

Rules:

- **The model never ranks anything.** The pick is a plain score anyone can read: how close the
  deadline is, whether someone is waiting, whether skipping costs money or a cutoff, and how many
  times you've already said "not today". The same list always gives the same pick, and the app
  says why: *"Because it's due tomorrow and Priya is waiting on it."*
- **Made-up details are dropped.** A deadline or a person Gemma returns is kept only if those words
  are in what you wrote.
- **The pick stays put for the day.** Opening the app again doesn't reshuffle it. Adding something
  urgent changes tomorrow, not today.
- **"Not today" is allowed, and it costs something.** Nothing replaces the task today unless you ask
  for another, and every skip makes it heavier tomorrow.
- **After "Done" the app tells you to stop.** "Give me another" is there, but it's not the default.
- **No WebGPU? It still works:** "One task per line, no AI" adds each line as a task, and code still
  reads the deadlines in it.

## Layout

```
web/
  index.html, styles.css, sw.js, manifest.webmanifest, icon.svg
  js/domain/   dates.js (deadline words → dates)  tasks.js (scoring, today's pick, skip/done)
               extract.js (prompts, JSON parsing, no-AI fallback, model pick)
  js/adapters/ gemma.js (WebLLM from CDN)  store.js (localStorage, this phone only)
  js/main.js   the three screens
test/          node:test, no dependencies
```

No dependencies and no build step.

## Run

```bash
npm test          # domain tests
npm run serve     # http://localhost:8080  (WebGPU needs localhost or https)
```

The first "Sort it with Gemma" downloads about 1.5 GB once (use Wi-Fi). After that it works offline.

## Deploy

`render.yaml` at the repo root deploys `just-one/web` as a Render static site, running the tests as
the build step.

## License

Apache-2.0 (see the repository root).
