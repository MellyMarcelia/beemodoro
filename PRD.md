---
title: Todobee & Beemodoro — Product Requirements Document
tags:
  - project-planning
  - prd
category: prd
---

# Todobee & Beemodoro — PRD

## 1. Product names and purpose

Two small, separate, offline desktop apps that share a bee theme and both log their activity into the same Obsidian vault, under separate top-level folders:

- **Todobee** — a cozy sticky-note style to-do list with a bee mascot. One note per day; unfinished tasks roll forward automatically; finished notes become browsable history.
- **Beemodoro** — a Pomodoro/focus-timer app: drag a snack onto a bee in the middle of the screen to start a focus session. Completed sessions fill a honeycomb, a simple visual history of the semester's focus effort.

Both are independent Electron apps, each with its own local SQLite database, sharing nothing at runtime except writing into the same user-selected Obsidian vault.

## 2. Intended user and problem

**User:** the apps' author, a student, using both daily for one semester to track their own software development work — tasks in Todobee, focus sessions in Beemodoro.

**Problem it solves:** existing to-do apps have no timer; existing focus timers have weak or no task linking; the closest hybrid (Focus To-Do) is closed, account-gated, and cloud-hosted. None are genuinely offline-first, and none write durable, human-readable history the user actually owns. Todobee and Beemodoro are local-first, offline, and log every event as plain markdown into the user's own Obsidian vault — small, single-purpose, fast to open, with no login and no sync spinner standing between the user and getting to work.

## 3. Todobee (to-do app)

### 3.1 Core features
- Sticky-note style UI with a bee mascot.
- **One note per day** ("today's note"): all of today's tasks live on one visual note.
- On launch, the app checks the current date; if it's a new day since last launch, it creates a fresh note for today and **rolls forward any unfinished tasks** from the previous note onto it. No live midnight timer — rollover is computed on launch only.
- Create, edit, delete, complete, and reopen tasks.
- **Reopening a task from a past (already-finished) day's note moves it immediately onto today's note** — it does not stay on the old note waiting for a future rollover.
- Finished notes are kept as **history**, browsable chronologically (oldest to newest).
- Data persists locally (SQLite) after closing/reopening the app.

### 3.2 Custom feature: bee rewards
- When every task on the current note is marked done, the bee mascot plays a one-time **celebration animation**.
- That day's note additionally gets a small persistent **"perfect day" badge**, visualized as a **"Good job" stamp graphic overlapping the note** (per hand-drawn concept sketch), visible when browsing history later.
- No points, currency, streak counter, or gamified economy — just the animation (transient) and the stamp/badge (persistent, computed from "were all tasks on this note completed").

### 3.3 History view
- Finished daily notes are displayed as a **wall board / corkboard**: past notes appear pinned to the board like sticky notes, browsable chronologically (oldest to newest), each showing its stamp if it earned one.
- The bee mascot sits at a small desk below the board (a static, cozy decorative touch — not interactive), reinforcing the "working bees" theme without adding functional complexity.
- This board *is* the history feature described in §3.1 — not a separate screen from "today's note" navigation, just the visual presentation of past notes once they're finished.

### 3.4 Obsidian logging
- Logs to: `<vault>/Todobee/Tasks/YYYY/YYYY-MM/YYYY-MM-DD.md`
- Logged events: task created / edited / completed / reopened / deleted (including the rollover of a task from one day's note to the next, logged as a normal edit/move on the origin day, not a duplicate creation).
- One append-only file per day; never overwritten.

### 3.5 Testable acceptance criteria
- [ ] Creating a task adds it to today's note and to SQLite; restarting the app still shows it.
- [ ] Editing a task's title/details updates it in place; a `task.edited` entry is appended to the vault log.
- [ ] Completing a task marks it done on today's note; a `task.completed` entry is appended.
- [ ] Reopening a task from a past, already-finished note removes it from that note's completed state and places it on **today's** note; a `task.reopened` entry is appended.
- [ ] Reopening a task that was completed **on today's own note** (not rolled over from a past day) simply marks it open again in place on today's note; a `task.reopened` entry is appended.
- [ ] Deleting a task removes it from its note; a `task.deleted` entry is appended; deletion is never silently unlogged.
- [ ] Launching the app on a new calendar day (vs. the last recorded launch date) automatically creates a new daily note and moves any unfinished tasks from the previous note onto it, without requiring the app to have been left running overnight.
- [ ] Each task rolled over to a new day is logged in **today's** log file (not the origin day's file) as a `task.edited` entry whose details note "moved from YYYY-MM-DD" (the origin day's date) — never a duplicate `task.created`.
- [ ] Launching the app twice on the same calendar day does not create a duplicate daily note or duplicate/roll over tasks a second time.
- [ ] Marking the last remaining open task on today's note as done triggers the bee's celebration animation exactly once and marks that day's note with a persistent "Good job" stamp/"perfect day" badge.
- [ ] Reopening any task on a note that previously earned a "perfect day" badge removes that badge/stamp (the day is no longer "all done").
- [ ] Browsing the history board shows past finished notes pinned chronologically (oldest to newest), each showing its tasks and, where applicable, its "Good job" stamp, with the bee mascot visible at its desk below the board.
- [ ] All task data (including rollover state and badges) survives a full app restart.

## 4. Beemodoro (Pomodoro app)

### 4.1 Core features
- Main screen: a **bee area** in the center-left, a snack tray on the right.
  - **Before a session starts**: instead of an idle bee, the panel shows a required "what will you focus on?" prompt with a single-line description field — the bee only appears once a session or break is active.
  - **Session running**: the same area switches to the **focus/timer view** — a progress bar, the bee's active animation, a countdown display, and session controls (pause/cancel) replace the description prompt.
- **Snack types (fixed set, customizable durations in Settings):**

  | Snack | Default duration |
  |---|---|
  | Pollen | 15 min |
  | Honey drop | 25 min |
  | Flower | 45 min |
  | Honey jar | 90 min |

- Dragging a snack onto the description field (or the bee, once a session/break is active), or simply clicking a snack row, starts a focus session of that snack's duration.
- Start, pause, resume, cancel, and complete focus sessions; take breaks between sessions. (Note: the assignment's "stop" requirement maps to **cancel** in Beemodoro — there is no separate "stop" action.)
- Each session requires a short **description** — the field is validated as required and blocks starting a session (with an inline error message) if left empty; there is no default-fallback text. A task-linking integration with Todobee is a documented future idea, not built now — see Non-Goals.
- **Breaks**: after a session completes, a "Take a break" button appears; pressing it starts a break of the configured break duration (default **5 min**, adjustable in Settings alongside the snack durations). The bee switches to its break pose for the break's duration; no honeycomb cell or log entry is created for the break itself. The reset/cancel control also works mid-break, ending it early and returning to idle.
- Review completed sessions via the honeycomb (primary visual) and a simple filterable list (secondary, detail lookups).
- **Lifetime stats line**: a small, always-visible readout showing **total focus time** and **total sessions completed**, computed directly from real session data — no separate scoring system.

### 4.2 Bee animation states
The bee's animation/pose changes with session state:

| State | Animation |
|---|---|
| Idle | not shown — replaced by the "what will you focus on?" prompt |
| Focus (running) | active/focused pose |
| Paused | a second, distinct pose (speech bubble still reads "zzzz...") |
| Break | a second, distinct happy pose (speech bubble reads "sip sip...") |
| Completed | happy pose |
| Cancelled | sad pose |

- Pausing excludes elapsed paused time from the logged/displayed duration.
- Cancelling ends the session permanently (not resumable); the bee shows its sad pose for that action, then returns to idle.

### 4.3 Custom feature: the honeycomb
- History is visualized as a **honeycomb**: each completed session fills one hexagon cell, colored by its snack type.
- A cancelled session fills a hexagon too, but shown as a **cracked cell** rather than a colored one — an honest, permanent record of an incomplete attempt (no "delete and forget" mechanic).
- Cells fill **chronologically, oldest to newest, wrapping row by row** — one continuous structure for the whole semester, no per-week/per-project grouping or layout logic.
- A simple filterable list (date, description, snack/duration, status) sits alongside the honeycomb for specific lookups the visual can't answer at a glance.

### 4.4 Obsidian logging
- Logs to: `<vault>/Beemodoro/Focus/YYYY/YYYY-MM/YYYY-MM-DD.md`
- Logged events: session started / completed / cancelled. (Pause/resume are in-app state only, never logged as separate end-events.)
- One append-only file per day; never overwritten.

### 4.5 Testable acceptance criteria
- [ ] Dragging a snack icon (or clicking a snack row) starts a session of the correct duration for that snack type; a `session.started` entry is appended; the bee switches to its focus pose.
- [ ] Starting a session with an empty description field shows an inline validation error and does not start a session; a non-empty description is required in both the running session and the resulting log entry.
- [ ] A progress bar in the Focus Time panel header fills proportionally to elapsed/planned time during a session, and to elapsed/planned time during a break (in a different colour); it is empty when idle.
- [ ] Pausing a session freezes the timer and switches the bee to its paused pose; resuming continues from the same elapsed time; no log entry is written for pause/resume.
- [ ] Cancelling a session (the app's equivalent of the assignment's "stop" action) stops it permanently, switches the bee to its sad pose, fills a cracked honeycomb cell, and appends a `session.cancelled` entry whose duration excludes any paused time.
- [ ] Letting a session run to completion switches the bee to its happy pose, fills a colored honeycomb cell (color = snack type), and appends a `session.completed` entry with the actual (non-paused) duration and the linked description.
- [ ] After a session completes, a "Take a break" button appears; pressing it starts a break of the configured break duration and switches the bee to its break pose; no honeycomb cell or log entry is created for the break.
- [ ] The cancel/reset control is available and functional during a break too, ending the break early and returning to idle without creating a honeycomb cell or log entry.
- [ ] Changing the break duration in Settings is respected by the next break started.
- [ ] Changing a snack type's duration in Settings is respected by the next session started with that snack.
- [ ] Honeycomb cells appear in chronological order (oldest to newest), filling row by row, matching the true order of sessions in SQLite.
- [ ] The list view can filter completed/cancelled sessions by date, description, snack, and status.
- [ ] The lifetime stats line shows total focus time and total sessions completed, both matching the sum/count of real completed sessions in SQLite; cancelled sessions do not count toward either figure.
- [ ] Completing a new session immediately updates the lifetime stats line (no restart required).
- [ ] Force-quitting the app mid-session and relaunching shows that session auto-closed as `cancelled`, using the last persisted elapsed time (no silent data loss, no crash-induced gap in the honeycomb or log).
- [ ] All session data (including honeycomb state) survives a full app restart.

**Vault selection (both apps)**
- [ ] Choosing a vault folder via the native folder picker in Settings saves the path locally and is remembered on next launch.
- [ ] Once a vault is chosen, all subsequent task/session events are appended into the correct folder structure under that vault.
- [ ] If no vault has been chosen yet, the app still fully works for its core features (tasks in Todobee; sessions/timer in Beemodoro) and displays a clear, visible warning that logging is not yet configured.
- [ ] If a previously chosen vault folder is missing/inaccessible at launch (e.g. moved or deleted), the app still fully works for its core features and displays a clear, visible warning that logging is currently failing, rather than crashing or silently dropping log entries.

**Setup from a clean clone (both apps)**
- [ ] Following each app's README from a fresh `git clone` (`npm install` then `npm run dev`) launches that app successfully with no manual/undocumented extra steps.

## 5. Non-goals (out of scope for this build)

- Mobile, web, or any platform beyond desktop (macOS-first; Electron enables Win/Linux later but is not tested/targeted now).
- Multi-user accounts, cloud sync, or login of any kind; optional future Supabase/Neon sync is deferred, would sit alongside (never replace) local SQLite.
- **Linking a Beemodoro session directly to a Todobee task** — sessions use a free-text description only in this build; direct task-linking between the two apps is a documented future integration idea.
- Any shared database, shared process, or IPC between Todobee and Beemodoro — they are fully independent apps that only happen to write into the same Obsidian vault.
- Points, currency, shop, or streak/heatmap gamification economy (the bee's celebration animation and "perfect day" badge are the only reward mechanics; no persistent score is kept).
- A live midnight rollover timer — rollover is computed only when Todobee is launched on a new day.
- App/website blocking during sessions (Forest/Session-style Deep Focus).
- Multi-device sync, backup automation, or export formats beyond the Obsidian markdown logs.
- Natural-language quick-add parsing, recurring tasks, sub-tasks, reminders, or calendar views.
- Team/shared projects, collaboration of any kind.
- Custom/user-defined snack types beyond the fixed set with tunable durations.
- An empty-description auto-fallback (e.g. "Honey drop session") — Beemodoro requires a non-empty description before a session can start; there is no default text.
- Dedicated bee art for every mood in this build — paused and break moods reuse spare bee assets (the "Scared Bee" and second "Happy Feliz" GIF) rather than commissioning purpose-made poses for those two states.

## 6. Main user flows

### 6.1 Todobee
1. **Launch app.** App checks today's date against the last note's date; if a new day, creates today's note and rolls forward any unfinished tasks from the previous note.
2. **Add a task.** Type into today's note, press Enter — task appears immediately, persisted to SQLite, logged as `task.created`.
3. **Work through the day.** Complete tasks as they're done (`task.completed`), edit details as needed (`task.edited`), delete anything no longer relevant (`task.deleted`).
4. **All done.** Completing the last open task on today's note triggers the bee's celebration animation and marks the note with a "perfect day" badge.
5. **Next day.** On next launch, any tasks left unfinished roll onto the new day's note; the previous note is sealed as history.
6. **Review history.** Browse past notes chronologically, including their perfect-day badges.
7. **Reopen from history.** Reopening a task on an old, finished note pulls it onto today's note instead of resurrecting the old one.

### 6.2 Beemodoro
1. **Launch app.** The left panel shows a required "what will you focus on?" prompt; snack tray is visible on the right.
2. **Start a session.** Type a description (required — starting with it empty shows an inline error and blocks the session), then drag a snack icon onto the field, or click a snack row. Timer starts; bee switches to focus pose; logged as `session.started`.
3. **Focus.** User can pause (bee switches pose, timer frozen, resumable) or cancel — the app's equivalent of the assignment's "stop" action (bee turns sad, session ends permanently, cracked honeycomb cell, logged as `session.cancelled`).
4. **Complete.** Timer reaches zero: bee turns happy, a colored honeycomb cell fills in, logged as `session.completed` with actual duration and description.
5. **Break.** A "Take a break" button appears; pressing it starts a break of the configured duration (default 5 min). Bee switches to its break pose; no honeycomb effect, no log entry; the break can be cancelled early via the same reset control.
6. **Review.** Scroll the honeycomb chronologically for a visual history, or use the filterable list for specific lookups.
7. **Close app.** Data already persisted continuously to SQLite; a force-quit mid-session is recovered as `cancelled` on next launch using the last saved elapsed time.

## 7. Technical decisions

**Framework:** Electron + Vue 3 + TypeScript for both apps, each scaffolded with `electron-vite`. Chosen because the user already knows Vue/JavaScript and wants to learn TypeScript through this project; kept beginner-friendly — simple interface types for Task/Session records, no advanced generics or type-level tricks.

**Two separate apps vs. one combined app:** built as **two independent Electron apps and codebases**, each with its own SQLite database and its own window/process, sharing nothing at runtime except both writing into the same user-selected Obsidian vault folder.
Alternative considered but not chosen: **one combined app with two tabs** (a single Electron process/window hosting both a Todobee tab and a Beemodoro tab, sharing one SQLite database). This would make the future "link a session to a Todobee task" integration trivial (shared DB, no cross-process calls) and would mean only one vault-picker/settings screen to build. It was set aside because the user wants each app to stay small, focused, and independently launchable/closable — e.g. running Beemodoro without Todobee open at all — and two small codebases are easier to reason about while learning TypeScript than one shared app with two feature areas from day one. Cross-app task-linking is left as a documented future idea (§5) that would need to bridge two separate local databases if built later (e.g. via a shared identifier written into both DBs and the Obsidian logs).

**Local storage:** SQLite via `better-sqlite3`, one `.db` file per app in that app's own Electron `userData` folder — the sole source of truth for that app's data. Synchronous API keeps the data layer simple for a TypeScript beginner. Native-module packaging uses the standard, documented Electron pattern (`asarUnpack: ["node_modules/better-sqlite3/**"]`) in both apps.
Alternative considered but not chosen: **PGlite** (Postgres-in-WASM) — appealing since the user already knows Postgres, but current GitHub issues show it hangs `electron-vite`/`electron-forge` builds (top-level-await/CJS bundling conflicts) and needs an unofficial `patch-package` fix to stop misdetecting Electron's renderer as plain Node. `better-sqlite3` is the boring, proven, widely-documented choice for a solo build that needs to work reliably from a clean clone.

**Obsidian vault structure (append-only, predictable, shared by both apps):**
```
<vault>/
  Todobee/
    Tasks/
      2026/
        2026-02/
          2026-02-14.md
  Beemodoro/
    Focus/
      2026/
        2026-02/
          2026-02-14.md
```
- Each app has its own top-level folder in the vault; the user points both apps at the same vault root via each app's own Settings screen and native folder picker (`dialog.showOpenDialog`) — never a typed path.
- One file per day per app; existing entries are never rewritten or overwritten, including during crash recovery.
- Each event is appended as a bullet block (never a table row — tables are fragile to append to safely). Every entry carries the **full date, time, and timezone inline** (not only derivable from the file name/path), plus an explicit event type and status field:
  ```
  - **2026-09-27 14:32:07 (Europe/Brussels, UTC+02:00)** — `session.completed` — Status: completed — Honey drop (25 min) — Description: "Build honeycomb view" — Duration: 25m00s
  - **2026-09-27 09:03:41 (Europe/Brussels, UTC+02:00)** — `task.created` — Status: active — "Write PRD acceptance criteria"
  ```
- A new daily file is created automatically on that day's first event for that app; no file is ever opened for writing except to append.
- The log is a write-only export layer in both apps — neither app ever reads its own or the other app's log back; each app's SQLite database remains its sole authoritative source.

**Screen layout:**
- Todobee: a single sticky-note canvas showing today's note front-and-center, with simple navigation (e.g. back/forward arrows or a small history list) to browse past finished notes; the history view itself renders as a wall board with pinned past notes and a static bee-at-a-desk illustration underneath.
- Beemodoro: the bee's area sits center-left and doubles as both the description prompt (before a session starts) and the running session's focus/timer view (progress bar, animation, countdown, controls) — no separate screen/route needed to switch between them; a snack tray is docked to the right for dragging; the honeycomb/list history and lifetime stats line are reachable via a dedicated view (a "Hive" toggle in the right panel).

**Usability decisions:**
- Todobee rollover and Beemodoro crash recovery are both computed **on launch**, never via a background timer — simpler, no sleep/wake edge cases, matches once-a-day usage patterns.
- Beemodoro pause excludes elapsed paused time from logged/displayed duration (tracked separately from wall-clock pause start/end).
- Beemodoro crash/force-quit recovery: elapsed session time is persisted to SQLite every ~10–15 seconds; on next launch, any session left "in progress" is auto-closed as `cancelled` using the last persisted elapsed time, and logged — no session is ever silently dropped.
- Vault folder is chosen via a native OS folder-picker dialog in both apps' Settings, never typed by hand, to avoid path-typo errors; both apps must be pointed at the same vault root by the user for the folder structure above to line up.
- If no vault is chosen yet, or a previously chosen vault folder becomes missing/inaccessible, neither app blocks its core features — each shows a clear, visible warning banner/indicator that logging is not currently happening, rather than crashing or queuing/dropping events silently.
- Each app ships with its own README documenting the exact fresh-clone setup (`npm install`, `npm run dev`) so a clean checkout runs without undocumented manual steps.
- Todobee's "perfect day" badge and Beemodoro's cancelled/completed honeycomb cell are both derived purely from real completion data — no separate currency or score is stored or displayed.
- Beemodoro's lifetime stats line (total focus time, total sessions) is likewise computed live from real SQLite session data, never a separately tracked/incrementable counter.
