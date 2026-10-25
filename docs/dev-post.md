---
title: "My to-do list had 40 things on it, so I replaced it with one sticky note"
published: false
tags: devchallenge, hf26challenge, gemma, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

Open your to-do app. Count the items. Don't do any of them, just count.

Mine had forty. Pay the electricity bill. Renew the passport. Reply to the society secretary. Call the plumber about the tap that has been dripping since July.

Every time I opened it, the same thing happened. I read all forty, felt bad about thirty-nine, couldn't decide which one mattered, and closed the app. Ten minutes gone, nothing done.

The list was never the problem. **Deciding** was the problem. And deciding is exactly the kind of work a lazy person will put off forever.

So I stopped deciding. I built an app that does it for me, shows me one thing, and then leaves me alone.

{% embed https://www.youtube.com/watch?v=BPLhi1_g-fA %}

## What I Built

**Just One** is a to-do list you only write once.

You dump everything on your mind into a lined pad, as one messy paragraph. Gemma, running on your phone, turns it into tasks. After that the app has exactly one screen: a single yellow sticky note with today's one thing on it, one line on why it's that one, and three buttons.

- **Done.** The note peels off the desk. The app says *"That was the one. You can stop now."* And it means it.
- **Make it smaller.** For the task that feels like a mountain. Gemma gives you a first step that takes under five minutes, and writes it on the note: *"Start here: open the doc and write the first three comments."*
- **Not today.** Allowed. No guilt trip, no replacement task. But the note comes back tomorrow a little heavier, so the things you dodge float to the top.

That's the whole app. There's an "All" screen if you insist on seeing everything, but you never have to open it.

### The sticky note rules

| Rule | Why |
| --- | --- |
| You write the list once | Organising a list is just procrastination with extra steps |
| One note a day | Forty items is a wall. One item is a door |
| The note doesn't change when you reopen the app | No reshuffling, no second-guessing |
| Every pick comes with a reason | *"Because it's due tomorrow and Priya is waiting on it."* You can check it |
| Done means stop | "Give me another" exists, but it's never the default |
| Skipping is free today, expensive tomorrow | Laziness is allowed. Avoidance gets noticed |
| The list never leaves your phone | It's your bills, your late replies, your passport |

## Demo

**Try it:** [just-one-s6f8.onrender.com](https://just-one-s6f8.onrender.com)

Open it in Chrome on Android or on a desktop with a decent GPU. Tap **Fill in an example**, then **Sort it with Gemma**. The first time, Gemma downloads once (about 1.5 GB, use Wi-Fi). After that it works in airplane mode.

No WebGPU on your device? Tap **One per line, no AI**. Every line becomes a task, and the deadlines in it still get read.

## Code

{% github abhijeetkaze/hackathon-2026 no-readme %}

It lives in [`just-one/`](https://github.com/abhijeetkaze/hackathon-2026/tree/main/just-one). One static page. No backend, no dependencies, no build step, 17 tests.

## How I Built It

### Round one: who gets to decide?

The obvious build is "send the list to an AI and ask what to do first." I didn't want that. Ask a model twice and you get two different answers, and neither comes with a reason you can check. A to-do app you can't trust is just a slower to-do app.

So the work is split in two:

- **Gemma reads.** It does the part code can't: turning *"priya's waiting on the design review, I told her tomorrow"* into a task with a title, the deadline words, who's waiting and a rough number of minutes. It also writes the five-minute first step when you tap Make it smaller.
- **Code decides.** Dates, scoring, today's pick and the reason sentence are plain JavaScript you can read in one file.

The whole ranking fits in a table:

| Signal | Points |
| --- | --- |
| Overdue | 100, plus 5 for each day late |
| Due today / tomorrow / in 3 days / in a week | 90 / 70 / 50 / 30 |
| Someone is waiting on it | +25 |
| Skipping costs money or a cutoff (fine, late fee, refund, expiry) | +20 |
| Each "Not today" | +8 |
| Takes 15 minutes or less | +5 |

Every point becomes part of the reason on the note. The same list always gives the same pick.

### Round two: don't trust a helpful model

Small models want to be helpful. A helpful model asked for deadlines might give "renew passport" a deadline you never wrote, and then the app would nag you about something that was never urgent.

I didn't want to find out the hard way. So a deadline or a person only survives if those exact words appear in what you typed. Then code, not Gemma, turns the words into a date: *by Friday, tomorrow, in 3 days, end of month, 30th, 3 Nov, 30/10* (day first). If code can't read it, there's no deadline. It never guesses.

### Round three: the lazy button was broken

Before shipping, I had the app driven in a headless browser on a phone-sized screen. Skip today's task, then tap "give me another", and the app handed back the exact task I had just skipped.

The rule that makes skipped tasks heavier was working perfectly. It made the skipped task the most important thing on the list, immediately. The fix: remember the day you skipped something, and never offer it again that same day. There's a test for it now.

### Round four: it looked like every other AI app

The first version was cream background, big serif headline, rounded cards. It worked, and it looked like a hundred other generated apps.

So I redesigned it around the one object the app is really about: **a single sticky note on an empty desk.** A butter-yellow note, slightly crooked, on a cool grey-blue desk. A marker-style font (Shantell Sans) for anything you'd scribble on a note, and Atkinson Hyperlegible for everything else. The list is written on a lined legal pad with a red margin. When you tap Done, the note peels off. When you tap Not today, it drops out of sight. What's left is a dashed outline where it used to be. Nothing else on screen moves, and if your phone asks for reduced motion, nothing moves at all.

Same headless browser, same screenshots. It caught one more bug: the "done for today" panel was showing all the time, because a CSS `display: grid` was beating the `hidden` attribute.

### The rest

- **Model:** Gemma 2 2B (q4f16, or q4f32 on GPUs without f16) through WebLLM on WebGPU, loaded from a CDN. I used 2B rather than Gemma 3 1B because 1B repeated itself on long prompts under WebLLM in my Week 1 project.
- **Storage:** `localStorage`, on your phone. There's a button to delete the whole list. No account, no server.
- **Offline:** a service worker caches the app and WebLLM caches the model. A test checks that every file the app needs is precached.
- **Hosting:** a Render static site from one `render.yaml`. The tests are the build step, so a failing test never deploys.

## Why Does Open Innovation Matter?

**Because a to-do list is a diary of everything you're avoiding.** Late bills. Replies you owe. The passport. I don't want that on someone's server so a model can tell me what to do first. With open weights, Gemma runs on the phone and the list never leaves it.

**Because a daily habit can't have a meter on it.** An app you open every morning can't depend on an API key, a rate limit or a monthly bill. Once Gemma is downloaded, sorting a list or shrinking a task costs nothing and needs no network.

**Because the part that matters is readable.** The ranking is a short score in one file. If you think "someone is waiting" should beat a deadline, change one number.

**Where a closed model would win:** untangling a really messy paragraph. A big hosted model would split tasks more cleanly than a 2B model on a phone. That's why the no-AI path exists and every task can be edited or removed. I'll take that trade for a list that stays mine.

## My Agent Session

I built Just One in a day with Claude Code. I picked the idea from a shortlist, insisted it be in plain English for everyone, and made the calls on what it should refuse to do: no reshuffling, no nagging, no "you could also do these five things". Claude Code wrote the code and the tests, then drove the app in a headless browser on a phone-sized screen, which is how both bugs above were caught before anyone else saw them.

## The Lazy Payoff

**Before:** open the list, read forty items, spend ten minutes deciding, feel bad, close it, do nothing.

**After:** open the app, read one note, tap Done. Or tap Not today and go back to the sofa without guilt.

You write the list once and never organise it, sort it or even read it again. Each day costs one glance and one tap. And when something feels too big, you don't break it down yourself. You tap a button and get the first five minutes.

You don't get more productive. You just get a sticky note that decides for you.

## Prize Categories

- **Best Use of Gemma**: Gemma 2 2B runs entirely on the phone through WebLLM. It turns a brain dump into tasks and writes a five-minute first step for anything too big, while code owns the dates and the ranking.
- **Best Use of Render**: the whole app is a Render static site deployed from one `render.yaml`, with the test suite as the build step, so a failing test never deploys. Live at [just-one-s6f8.onrender.com](https://just-one-s6f8.onrender.com).

---

*Built solo in Pune, October 2026. I drafted this post with Claude Code and edited it myself.*
