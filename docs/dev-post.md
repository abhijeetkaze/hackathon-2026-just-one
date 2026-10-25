---
title: "Just One: tell it everything once, and every morning it shows you one thing"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

My to-do list has never once helped me do anything. It's a list of forty things, and every time I open it I spend ten minutes deciding which one matters, feel bad about the other thirty-nine, and close it. The deciding is the work I'm avoiding.

So I built **Just One**. You tell it everything you've been putting off, once, as one messy paragraph. After that it has one screen: the single thing to do today, one line on why it's that one, and three buttons. **Done**. **Too big? Make it smaller**. **Not today**.

**TL;DR.** Gemma runs on your phone and turns a brain dump into tasks. Plain code reads the deadlines and picks today's one thing with a reason you can check. Done means you can stop. Your list never leaves the phone, and it works in airplane mode.

## What I Built

- **Empty your head once.** *"pay the electricity bill by friday or there's a late fee. priya is waiting on the design review, I told her tomorrow. renew my passport sometime. return the amazon parcel in 3 days or I lose the refund…"* Gemma splits that into tasks: a short title, the deadline words, who's waiting, what skipping costs, and a rough number of minutes.
- **One thing a day.** Each morning the app shows one task: *"Send Priya the design review. Because it's due tomorrow and Priya is waiting on it."* Opening the app again doesn't reshuffle it.
- **Too big? Make it smaller.** One tap and Gemma gives you a first step you can do in under five minutes: *"Open the electricity board site and find this month's bill."* The step sits under the task until you're done.
- **Not today.** Allowed, with no guilt trip. Nothing replaces it today unless you ask. But every skip makes that task heavier tomorrow, so the things you dodge come back first.
- **Done means stop.** After you finish, the app says *"That was the one. You can stop now."* There's a "give me another" button for days you're on a roll, but it's never the default.
- **Everything, if you insist.** One tap shows the whole list in the order you'll get it, so you can fix a date or delete something. You don't have to look at it.

**Why not just ask ChatGPT what to do today?** Because you'd have to paste your whole life into it every morning, it would give a different answer each time, and it can't tell you *why* in a way you can check. Just One remembers the list on your phone, gives the same pick for the same list, and shows its reasoning in one sentence.

## Demo

**Try it:** [just-one-s6f8.onrender.com](https://just-one-s6f8.onrender.com). Open it in Chrome on an Android phone or a desktop with a recent GPU. Tap **Example**, then **Sort it with Gemma**. The first run downloads Gemma once (about 1.5 GB, use Wi-Fi), and after that it works in airplane mode. No WebGPU? Tap **One task per line, no AI** and it still works, deadlines included.


## Code

{% github abhijeetkaze/hackathon-2026 %}

The project lives in [`just-one/`](https://github.com/abhijeetkaze/hackathon-2026/tree/main/just-one). One static page, no backend, no dependencies, no build step, and 17 `node:test` tests.

## How I Built It

### Gemma reads, code decides

A to-do app that picks for you only works if you trust the pick. If a model ranked the list, the pick would change every time you asked and you'd never know why. So the work is split:

- **Gemma** does the part code can't: reading a messy paragraph and turning it into separate tasks, and suggesting a tiny first step for a task that feels too big.
- **Code** does everything that has to be right: turning deadline words into dates, scoring, picking, and the reason sentence.

The score is small enough to read in one go:

| Signal | Points |
| --- | --- |
| Overdue | 100, plus 5 a day late |
| Due today / tomorrow / within 3 days / within a week | 90 / 70 / 50 / 30 |
| Someone is waiting on it | +25 |
| Skipping costs money or a cutoff (fine, late fee, refund, expiry…) | +20 |
| Each time you said "not today" | +8 |
| Takes 15 minutes or less | +5 |

Every point it adds becomes part of the reason: *"Because it's due in 3 days, Priya is waiting on it and you skipped it once already."*

### Made-up details are dropped

Small models like to be helpful. Ask Gemma 2B for deadlines and it will sometimes give "renew passport" a deadline of "next month" that you never wrote. So a deadline or a person is kept only if those exact words appear in your dump. Then code, not the model, turns the words into a date: "by friday", "in 3 days", "30th", "end of month", "3 Nov", "30/10" (day first). If code can't read it, there's no deadline. It never guesses.

### The bug the test drive caught

I drove the app in a headless browser before shipping. Skip the day's task, tap "give me another", and it handed back **the task I had just skipped**: skipping made it heavier, so it was still the top score. The fix was to remember the day you skipped something and never offer it again that day. There's a test for it now.

### The rest

- **Gemma:** Gemma 2 2B (q4f16, or q4f32 on GPUs without f16) through WebLLM on WebGPU, loaded from a CDN at runtime. I used 2B rather than Gemma 3 1B because 1B repeated itself on long prompts under WebLLM in my earlier project.
- **Storage:** the list lives in `localStorage` on your phone. There's a "delete everything" button, and no account or server.
- **Offline:** a service worker caches the app, and WebLLM caches the model. A test checks the service worker precaches every file the app needs.
- **Hosting:** a Render static site from one `render.yaml`, with the tests as the build step.
- **Design:** the whole app is one sticky note on an empty desk. *Done* peels the note off, *Not today* drops it out of sight, and what's left is a dashed outline where it was. The list is written on a lined legal pad. Shantell Sans for anything you'd scribble on a note, Atkinson Hyperlegible for everything else, and no motion if your phone asks for less.

## The Lazy Payoff

The laziest thing about a to-do list is deciding what to do. Just One takes that away completely: you write the list once and never organise it, sort it or even read it again. Each day costs one glance and one tap. On a good day you tap Done and you're allowed to stop. On a bad day you tap Not today and nothing nags you until tomorrow. And when a task feels too big, you don't break it down yourself. You tap a button and get the first five minutes.

## Why Does Open Innovation Matter?

**Because a to-do list is private.** Mine has the bills I'm late on, the people I owe replies and a passport I keep forgetting. I don't want that on someone else's server so a model can tell me what to do first. With open weights, Gemma runs on the phone and the list never leaves it.

**Because it has to work every single morning, for free.** A daily habit can't depend on an API key, a rate limit or a monthly bill. Once Gemma is downloaded, splitting a list or suggesting a first step costs nothing and needs no network.

**Because the important part is open too.** The ranking is a short, readable score in one file. If you think "someone is waiting" should matter more than a deadline, change one number.

**Where a closed model would do better:** splitting a really tangled paragraph. A large hosted model would separate tasks more cleanly than a 2B model on a phone. That's why the "One task per line, no AI" path exists, and why every task can be edited or deleted. I'll take that for a list that stays mine.

## My Agent Session

I built Just One in a day with Claude Code. I picked the idea from a shortlist (it had to reward laziness, and I wanted it in English for everyone), and made the calls on what it should and shouldn't do. Claude Code wrote the code and tests, then drove the app in a headless browser on a phone-sized screen, which is how the skip bug above turned up before anyone else saw it.

## Prize Categories

- **Best Use of Gemma**: Gemma 2 2B runs entirely on the phone through WebLLM. It turns a brain dump into tasks and suggests a five-minute first step for anything too big, while code owns the dates and the ranking.
- **Best Use of Render**: the whole app is a Render static site deployed from one `render.yaml`, with the test suite as the build step, so a failing test never deploys. Live at [just-one-s6f8.onrender.com](https://just-one-s6f8.onrender.com).

---

*Built solo in Pune, October 2026. I drafted this post with Claude Code and edited it myself.*
