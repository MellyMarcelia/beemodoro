<script setup lang="ts">
// The tools this file borrows: helpers from Vue (the toolkit that builds the
// screen), the shared data shapes and snack names, the smaller screen pieces
// (bee, title strip, snack picture, hexagon, settings popup), and the drag helper.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { BeeMood, Session, SnackType, VaultStatus } from '../../shared/types'
import { SNACK_LABELS, SNACK_ORDER } from '../../shared/types'
import Bee from './components/Bee.vue'
import PanelHeader from './components/PanelHeader.vue'
import SnackIcon from './components/SnackIcon.vue'
import Hexagon from './components/Hexagon.vue'
import SettingsScreen from './screens/SettingsScreen.vue'
import { setSnackDragImage } from './snackDragImage'

// The main screen of the app. Left panel: the timer and the bee. Right panel:
// the snack menu (or the Hive, your session history). Almost all of the
// "what's happening right now?" logic lives in this file.

// ---------------------------------------------------------------------------
// Obsidian vault warning: a banner at the top if no vault folder is picked or
// it can't be found. The rest of the app keeps working either way.
const vaultStatus = ref<VaultStatus | null>(null) // the saved folder, and whether it still exists
// Asks the backstage (main/index.ts) about the vault folder. If that fails,
// just note the error for developers; the banner simply won't show.
async function loadVaultStatus(): Promise<void> {
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    console.error('Failed to load vault status:', error)
  }
}

// ---------------------------------------------------------------------------
// Settings popup (opened with Cmd+,).
const showSettings = ref(false) // true while the Settings popup is open
// The menu bar (in main/index.ts) sends an 'open-settings' message; we show the popup.
function openSettingsFromMenu(): void {
  showSettings.value = true
}
// When Settings closes, reload everything in case something was changed.
function closeSettings(): void {
  showSettings.value = false
  loadVaultStatus()
  loadSettings()
}

// ---------------------------------------------------------------------------
// What's happening right now, and what's shown on screen.
const activeSession = ref<Session | null>(null) // the session going on right now (null = nothing going on)
const description = ref('') // whatever's typed in the "what will you focus on?" box
const elapsedSeconds = ref(0) // how many seconds you've focused so far (paused time doesn't count)
const isOnBreak = ref(false) // true while a break is counting down
const breakRemaining = ref(0) // seconds left on the break countdown
// Starting values, replaced by your saved lengths as soon as they load.
const snackDurations = ref<Record<SnackType, number>>({
  pollen: 15,
  'honey-drop': 25,
  flower: 45,
  'honey-jar': 90
})
const breakMinutes = ref(5) // how long a break lasts, in minutes
const stats = ref({ totalSessions: 0, totalFocusMinutes: 0 }) // all-time totals under the snack menu
const rightView = ref<'snacks' | 'hive'>('snacks') // which page the right panel is showing
const history = ref<Session[]>([]) // every past session, for the Hive
const showCancelConfirm = ref(false) // the "are you sure?" popup
const descriptionError = ref(false) // turns on when you try to start without typing anything
// Hive filters (left empty = show everything).
const filterDate = ref('') // only show sessions from this day
const filterDescription = ref('') // only show sessions whose description contains this text
const filterSnack = ref<SnackType | ''>('') // only show this snack
const filterStatus = ref<'completed' | 'cancelled' | ''>('') // only show finished or only cancelled

// The once-a-second timers for focus and break. We keep hold of them so we
// can stop them later.
let tickHandle: ReturnType<typeof setInterval> | null = null
let breakHandle: ReturnType<typeof setInterval> | null = null

// These three ask the backstage (main/index.ts) for fresh data and keep it.

// Your saved snack and break lengths.
async function loadSettings(): Promise<void> {
  const settings = await window.api.getSettings()
  snackDurations.value = settings.snackDurations
  breakMinutes.value = settings.breakMinutes
}

// Your all-time totals (shown under the snack menu).
async function loadStats(): Promise<void> {
  stats.value = await window.api.getStats()
}

// Every past session (shown in the Hive).
async function loadHistory(): Promise<void> {
  history.value = await window.api.listSessions()
}

// Picks which bee animation to show based on what's happening.
const mood = computed<BeeMood>(() => {
  if (isOnBreak.value) return 'break'
  if (!activeSession.value) return 'idle'
  if (activeSession.value.status === 'paused') return 'paused'
  if (activeSession.value.status === 'completed') return 'completed'
  if (activeSession.value.status === 'cancelled') return 'cancelled'
  return 'focus'
})

// Time left on the focus clock (never goes below zero).
const remainingSeconds = computed(() => {
  if (!activeSession.value) return 0
  return Math.max(0, activeSession.value.plannedSeconds - elapsedSeconds.value)
})

// The progress bar at the top: fills up during a session, then fills again
// (in green) during the break. Empty when nothing is going on.
const headerProgress = computed(() => {
  if (isOnBreak.value) {
    const totalBreakSeconds = breakMinutes.value * 60
    if (totalBreakSeconds <= 0) return 0
    return (totalBreakSeconds - breakRemaining.value) / totalBreakSeconds
  }
  if (!activeSession.value || activeSession.value.plannedSeconds <= 0) return 0
  return elapsedSeconds.value / activeSession.value.plannedSeconds
})

// Orange during a session, green during a break.
const headerProgressColor = computed(() =>
  isOnBreak.value ? 'var(--color-dot-left)' : 'var(--color-snack-honey-drop)'
)

// The reset (↻) button only does something mid-session or mid-break.
const canCancel = computed(
  () =>
    isOnBreak.value ||
    activeSession.value?.status === 'running' ||
    activeSession.value?.status === 'paused'
)

// Turns seconds into a clock look, like 125 -> "02:05".
function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// The big numbers on screen: break countdown if on break, otherwise focus countdown.
const timerLabel = computed(() =>
  isOnBreak.value ? formatClock(breakRemaining.value) : formatClock(remainingSeconds.value)
)

// When a session ends, the happy or sad bee stays on screen for a few seconds
// before going back to the start. This is that short wait.
let endedResultTimeout: ReturnType<typeof setTimeout> | null = null
const showTakeBreak = ref(false) // shows the "Take a break" button after finishing

// Stops the focus timer from counting.
function stopTicking(): void {
  if (tickHandle) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

// The heartbeat of a session: every second, add 1 to the count. Every 5
// seconds, save it (so a crash only loses a few seconds). When the count
// reaches the planned time, the session is done.
function startTicking(session: Session): void {
  stopTicking() // make sure there's never two timers running at once
  elapsedSeconds.value = session.elapsedSeconds
  let sinceLastPersist = 0 // seconds since we last saved
  tickHandle = setInterval(async () => {
    // Paused or finished? Don't count.
    if (!activeSession.value || activeSession.value.status !== 'running') return
    elapsedSeconds.value += 1
    sinceLastPersist += 1
    if (sinceLastPersist >= 5) {
      sinceLastPersist = 0
      await window.api.tickSession(session.id, elapsedSeconds.value)
    }
    if (elapsedSeconds.value >= session.plannedSeconds) {
      await completeSession()
    }
  }, 1000)
}

// On launch: if a session is still going, pick it back up where it left off.
async function loadActiveSession(): Promise<void> {
  const session = await window.api.getActiveSession()
  activeSession.value = session
  if (session) {
    description.value = session.description
    elapsedSeconds.value = session.elapsedSeconds
    if (session.status === 'running') startTicking(session)
  }
}

// No blank descriptions allowed, the bee needs to know what you're working on!
function validateDescription(): boolean {
  if (!description.value.trim()) {
    descriptionError.value = true
    return false
  }
  descriptionError.value = false
  return true
}

// Kicks off a new session with the snack you picked (clicked or dragged).
// Does nothing if a session is already going or the description is empty.
async function startWithSnack(snack: SnackType): Promise<void> {
  if (activeSession.value) return
  if (!validateDescription()) return
  const created = await window.api.startSession({ snack, description: description.value.trim() })
  activeSession.value = created
  elapsedSeconds.value = 0
  showTakeBreak.value = false
  startTicking(created)
}

// You grabbed a snack! We tuck the snack's name into the drag so the drop
// spot knows which one it was.
function onSnackDragStart(event: DragEvent, snack: SnackType): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('text/plain', snack)
  // Drag just the snack picture, not the square box behind it.
  const img = (event.currentTarget as HTMLElement).querySelector('img')
  if (img) setSnackDragImage(event, img)
}

// You let go of the snack over the drop area: read which snack it was and start.
function onBeeDrop(event: DragEvent): void {
  event.preventDefault()
  const snack = event.dataTransfer?.getData('text/plain') as SnackType | undefined
  if (snack) startWithSnack(snack)
}

// Things can't be dropped anywhere by default, so this says "dropping here is OK".
function onBeeDragOver(event: DragEvent): void {
  event.preventDefault()
}

// The big button: pauses if running, resumes if paused, and saves the change.
async function pauseOrResume(): Promise<void> {
  if (!activeSession.value) return
  if (activeSession.value.status === 'running') {
    // Pausing: stop the clock, then save the time so far and the new "paused" state.
    stopTicking()
    const updated = await window.api.pauseSession(activeSession.value.id, elapsedSeconds.value)
    activeSession.value = updated
  } else if (activeSession.value.status === 'paused') {
    // Resuming: save the "running" state, then start the clock again.
    const updated = await window.api.resumeSession(activeSession.value.id)
    activeSession.value = updated
    startTicking(updated)
  }
}

// Time's up, you did it! Save it as completed, refresh stats + hive, offer a
// break, and if you don't take one within 4 seconds, go back to idle.
async function completeSession(): Promise<void> {
  if (!activeSession.value) return
  stopTicking()
  const finished = await window.api.completeSession(activeSession.value.id, elapsedSeconds.value)
  activeSession.value = finished
  showTakeBreak.value = true
  await loadStats()
  await loadHistory()
  endedResultTimeout = setTimeout(() => {
    if (!isOnBreak.value) resetToIdle()
  }, 4000)
}

// You said "yes, cancel" in the popup. On a break, that just skips the break.
// Mid-session, it saves the session as cancelled, shows the sad bee for 3
// seconds, then goes back to idle.
async function confirmCancel(): Promise<void> {
  showCancelConfirm.value = false
  if (isOnBreak.value) {
    stopBreak()
    return
  }
  if (!activeSession.value) return
  stopTicking()
  const cancelled = await window.api.cancelSession(activeSession.value.id, elapsedSeconds.value)
  activeSession.value = cancelled
  await loadStats()
  await loadHistory()
  endedResultTimeout = setTimeout(resetToIdle, 3000)
}

// Wipe the slate clean: back to the "what will you focus on?" screen.
function resetToIdle(): void {
  if (endedResultTimeout) {
    clearTimeout(endedResultTimeout)
    endedResultTimeout = null
  }
  activeSession.value = null
  description.value = ''
  elapsedSeconds.value = 0
  showTakeBreak.value = false
}

// Break time! Counts down once a second and ends itself at zero. Breaks are
// only shown on screen; they're never saved or written to Obsidian.
function startBreak(): void {
  if (endedResultTimeout) {
    clearTimeout(endedResultTimeout)
    endedResultTimeout = null
  }
  showTakeBreak.value = false
  isOnBreak.value = true
  breakRemaining.value = breakMinutes.value * 60
  breakHandle = setInterval(() => {
    breakRemaining.value -= 1
    if (breakRemaining.value <= 0) {
      stopBreak()
    }
  }, 1000)
}

// Break's over (or skipped): stop the countdown and go back to idle.
function stopBreak(): void {
  if (breakHandle) {
    clearInterval(breakHandle)
    breakHandle = null
  }
  isOnBreak.value = false
  resetToIdle()
}

// Each snack has its own colour (set in base.css); this looks it up by name.
function snackColor(snack: SnackType): string {
  return `var(--color-snack-${snack})`
}

// The Hive list after the filters are applied. Only finished sessions show up
// (completed or cancelled), never the one that's still going.
const filteredHistory = computed(() =>
  history.value.filter((session) => {
    // Each line below throws the session out if it doesn't match a filter
    // you've filled in. The date check compares just the "2026-09-28" part.
    if (filterDate.value && session.startedAt.slice(0, 10) !== filterDate.value) return false
    if (
      filterDescription.value &&
      !session.description.toLowerCase().includes(filterDescription.value.toLowerCase())
    )
      return false
    if (filterSnack.value && session.snack !== filterSnack.value) return false
    if (filterStatus.value && session.status !== filterStatus.value) return false
    return session.status === 'completed' || session.status === 'cancelled'
  })
)

// The Hive / Back button: flips the right panel between snacks and history.
function toggleRightView(): void {
  rightView.value = rightView.value === 'hive' ? 'snacks' : 'hive'
  loadHistory()
}

// When the app opens: load everything, then listen for the Settings shortcut.
onMounted(async () => {
  loadVaultStatus()
  await loadSettings()
  await loadStats()
  await loadHistory()
  await loadActiveSession()
  // When the menu bar says "open-settings", show the Settings popup.
  window.electron.ipcRenderer.on('open-settings', openSettingsFromMenu)
})

// Tidy up when the screen closes so nothing keeps running in the background.
onUnmounted(() => {
  // Stop both timers, and stop listening for the Settings shortcut.
  stopTicking()
  if (breakHandle) clearInterval(breakHandle)
  window.electron.ipcRenderer.removeListener('open-settings', openSettingsFromMenu)
})
</script>

<!-- What you actually see on screen. Lines with v-if / v-else only show up
     when their condition is true, so different bits appear at different times. -->
<template>
  <div class="app-shell">
    <!-- Yellow nag banner at the top if Obsidian logging isn't set up or the folder went missing -->
    <p v-if="vaultStatus && !vaultStatus.path" class="vault-banner">
      Logging is not configured yet; choose an Obsidian vault in Settings (Cmd+,)
    </p>
    <p v-else-if="vaultStatus && !vaultStatus.exists" class="vault-banner">
      Your vault folder can't be found; logging is currently failing. Choose it again in Settings
    </p>

    <div class="panels">
      <!-- LEFT PANEL: FOCUS TIME -->
      <section class="panel panel-left">
        <!-- Title strip with the green dot and the progress bar -->
        <PanelHeader
          label="Focus Time"
          dot-color="var(--color-dot-left)"
          :progress="headerProgress"
          :progress-color="headerProgressColor"
        />

        <div class="left-body">
          <!-- Nothing going on: ask what you'll focus on (you can drop a snack on the box too) -->
          <template v-if="!activeSession && !isOnBreak">
            <p class="prompt-label">What will you focus on?</p>
            <!-- Typing clears the red error; dropping a snack here starts a session -->
            <input
              v-model="description"
              class="description-input"
              :class="{ error: descriptionError }"
              type="text"
              placeholder="e.g. finish my report"
              @input="descriptionError = false"
              @dragover="onBeeDragOver"
              @drop="onBeeDrop"
            />
            <p v-if="descriptionError" class="description-error">
              Describe your focus first, then pick a snack.
            </p>
          </template>
          <!-- Something's going on: show the bee in whatever mood fits -->
          <template v-else>
            <div class="bee-drop-target" @dragover="onBeeDragOver" @drop="onBeeDrop">
              <Bee :mood="mood" />
            </div>
          </template>
        </div>

        <!-- Bottom strip: cancel button + big clock on the left, action button on the right -->
        <div class="bottom-bar">
          <div class="timer-side">
            <!-- The ↻ button: opens the "are you sure?" popup. Hidden when there's nothing to cancel -->
            <button
              class="reset-icon"
              aria-label="Cancel session"
              :class="{ hidden: !canCancel }"
              @click="showCancelConfirm = true"
            >
              <!-- Shifted slightly so the arrow icon looks centred in its box -->
              <svg
                viewBox="1 0 24 24"
                width="26"
                height="26"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="square"
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <!-- The big clock -->
            <span class="timer">{{ timerLabel }}</span>
          </div>
          <!-- The big button changes depending on the state: on break / pause / resume / take a break / done.
               When nothing is going on, none of these match, so there's no button (you start by picking a snack). -->
          <button v-if="isOnBreak" class="action-button break-active" disabled>On break</button>
          <button
            v-else-if="activeSession?.status === 'running'"
            class="action-button pause"
            @click="pauseOrResume"
          >
            Pause
          </button>
          <button
            v-else-if="activeSession?.status === 'paused'"
            class="action-button start"
            @click="pauseOrResume"
          >
            Resume
          </button>
          <button
            v-else-if="activeSession?.status === 'completed' && showTakeBreak"
            class="action-button start"
            @click="startBreak"
          >
            Take a break
          </button>
          <button v-else-if="activeSession" class="action-button pause" disabled>
            {{ activeSession?.status === 'completed' ? 'Completed' : 'Cancelled' }}
          </button>
        </div>
      </section>

      <!-- RIGHT PANEL -->
      <section class="panel panel-right">
        <!-- Title changes: "Now working on" mid-session, otherwise "Hive" or "Snacks" -->
        <PanelHeader
          :label="
            activeSession && !isOnBreak
              ? 'Now working on'
              : rightView === 'hive'
                ? 'Hive'
                : 'Snacks'
          "
          dot-color="var(--color-dot-right)"
        >
          <template #action>
            <!-- The Hive / Back button, hidden mid-session -->
            <button v-if="!activeSession || isOnBreak" class="hive-toggle" @click="toggleRightView">
              {{ rightView === 'hive' ? 'Back' : 'Hive' }}
            </button>
          </template>
        </PanelHeader>

        <div class="right-body">
          <!-- Mid-session: just show what you're working on, big -->
          <template v-if="activeSession && !isOnBreak">
            <p class="working-on">{{ activeSession.description }}</p>
          </template>

          <!-- Hive view: one hexagon per session (cracked = cancelled), filters, and a history list -->
          <template v-else-if="rightView === 'hive'">
            <div class="honeycomb">
              <Hexagon
                v-for="session in history"
                :key="session.id"
                :fill="snackColor(session.snack)"
                :cracked="session.status === 'cancelled'"
              />
            </div>
            <!-- Filters: date, description, snack, status -->
            <div class="filter-row">
              <input
                v-model="filterDate"
                type="date"
                class="filter-input"
                aria-label="Filter by date"
              />
              <input
                v-model="filterDescription"
                type="text"
                class="filter-input"
                placeholder="Filter description"
              />
              <select v-model="filterSnack" class="filter-input">
                <option value="">All snacks</option>
                <option v-for="snack in SNACK_ORDER" :key="snack" :value="snack">
                  {{ SNACK_LABELS[snack] }}
                </option>
              </select>
              <select v-model="filterStatus" class="filter-input">
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <!-- The list of past sessions that match the filters -->
            <ul class="history-list">
              <li v-for="session in filteredHistory" :key="session.id" class="history-row">
                <span class="history-date">{{ session.startedAt.slice(0, 10) }}</span>
                <span class="history-desc">{{ session.description }}</span>
                <span class="history-snack">{{ SNACK_LABELS[session.snack] }}</span>
                <span class="history-status" :class="session.status">{{ session.status }}</span>
              </li>
              <li v-if="filteredHistory.length === 0" class="history-empty">No sessions match.</li>
            </ul>
          </template>

          <!-- Snack menu: click a snack or drag it to the left panel to start. Stats underneath. -->
          <template v-else>
            <ul class="snack-list">
              <!-- One row per snack. Clicking anywhere on the row starts it; only the picture box can be dragged -->
              <li
                v-for="snack in SNACK_ORDER"
                :key="snack"
                class="snack-row"
                @click="startWithSnack(snack)"
              >
                <span
                  class="snack-icon-cell"
                  draggable="true"
                  @dragstart="onSnackDragStart($event, snack)"
                >
                  <SnackIcon :snack="snack" />
                </span>
                <span class="snack-name">{{ SNACK_LABELS[snack] }}</span>
                <span class="snack-duration">{{ snackDurations[snack] }} MIN</span>
              </li>
            </ul>

            <!-- Your all-time totals -->
            <div class="stats-box">
              <div class="stats-row">
                <span>Total sessions</span>
                <span>{{ stats.totalSessions }}</span>
              </div>
              <div class="stats-row">
                <span>Total focus</span>
                <span>{{ stats.totalFocusMinutes }} mins</span>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>

    <!-- "Are you sure?" popup for cancelling a session or skipping a break -->
    <div v-if="showCancelConfirm" class="modal-overlay">
      <div class="modal">
        <p v-if="isOnBreak">Skip this break and go back to idle?</p>
        <p v-else>Cancel this session? Progress will be recorded as cancelled.</p>
        <div class="modal-actions">
          <button @click="showCancelConfirm = false">Keep going</button>
          <button class="danger" @click="confirmCancel">
            {{ isOnBreak ? 'Skip break' : 'Cancel session' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Settings popup (Cmd+,) -->
    <div v-if="showSettings" class="modal-overlay">
      <SettingsScreen @close="closeSettings" />
    </div>
  </div>
</template>

<!-- How everything looks: colours, sizes, spacing. Each block is named after
     the class="..." it styles in the section above. -->
<style scoped>
/* The whole window: some breathing room around the edges, and everything stacked top to bottom. */
.app-shell {
  width: 100%;
  height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* The pale yellow warning strip at the top about the Obsidian folder. */
.vault-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-ink);
  padding: 8px 14px;
  font-size: 13px;
}

/* The row that holds the two big panels side by side, with a gap between them. */
.panels {
  flex: 1;
  display: flex;
  gap: 32px;
  min-height: 0;
}

/* What both panels have in common: light fill, dark outline, contents stacked top to bottom. */
.panel {
  background: var(--color-panel);
  border: var(--outline-width) solid var(--color-ink);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* The left panel takes up about two-thirds of the width... */
.panel-left {
  flex: 0 0 65%;
}

/* ...and the right panel gets whatever space is left. */
.panel-right {
  flex: 1;
}

/* The middle of the left panel (between the title strip and the clock). Everything in it sits in the centre. */
.left-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 20px;
  min-height: 0;
  overflow: hidden;
}

/* The area around the bee. You can drop a snack here to start. */
.bee-drop-target {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Fill the space between the header and the timer so the bee can shrink to fit. */
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* The small grey "What will you focus on?" text above the typing box. */
.prompt-label {
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-muted);
  font-size: 14px;
}

/* The box where you type what you'll focus on. No box outline, just a line underneath, text centred. */
.description-input {
  width: 60%;
  min-width: 260px;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-ink);
  padding: 8px 4px;
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--color-ink);
  text-align: center;
  outline: none;
}

/* The faded example text ("e.g. finish my report") shown before you type. */
.description-input::placeholder {
  color: var(--color-placeholder);
}

/* The line under the box turns pink-red if you try to start without typing anything. */
.description-input.error {
  border-bottom-color: var(--color-rose);
}

/* The small pink-red message under the box saying what's missing. */
.description-error {
  color: var(--color-rose);
  font-size: 12px;
}

/* The strip along the bottom of the left panel: clock on the left, big button on the right. */
.bottom-bar {
  height: 190px;
  min-height: 190px;
  border-top: var(--outline-width-thick) solid var(--color-ink);
  display: flex;
}

/* The left part of that strip: the ↻ button and the clock, side by side and centred. */
.timer-side {
  flex: 0 0 62%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

/* The small square ↻ (cancel) button next to the clock. */
.reset-icon {
  width: 48px;
  height: 48px;
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-panel);
  color: var(--color-ink);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

/* It turns orange when your mouse is over it. */
.reset-icon:hover {
  background: var(--color-snack-honey-drop);
}

/* Invisible but still taking up space, so the timer doesn't jump around when it appears. */
.reset-icon.hidden {
  visibility: hidden;
}

/* The big countdown numbers, in the retro computer font. */
.timer {
  font-family: var(--font-timer);
  font-size: 88px;
  line-height: 1;
}

/* The big button on the right of the bottom strip (Pause, Resume, Take a break...). This is the look they all share. */
.action-button {
  flex: 1;
  border: none;
  border-left: var(--outline-width-thick) solid var(--color-ink);
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 30px;
  cursor: pointer;
  color: var(--color-ink);
}

/* Yellow version: Resume and Take a break. */
.action-button.start {
  background: var(--color-honey);
}

/* Pink version: Pause (and the Completed / Cancelled messages). */
.action-button.pause {
  background: var(--color-rose);
}

/* The "On break" version: a softer colour, and the mouse doesn't turn into a hand since you can't click it. */
.action-button.break-active {
  background: var(--color-icon-cell);
  cursor: default;
}

/* Everything under the right panel's title strip. Scrolls if there's too much to fit. */
.right-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

/* The big text showing what you're working on during a session, centred in the panel. */
.working-on {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-transform: uppercase;
  font-size: 28px;
  padding: 20px;
}

/* The small "Hive" / "Back" button in the right panel's title strip. */
.hive-toggle {
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-panel);
  padding: 6px 12px;
  text-transform: uppercase;
  font-family: var(--font-display);
  font-size: 12px;
  cursor: pointer;
}

/* The list of the four snacks. Scrolls if the window is too short to fit them all. */
.snack-list {
  flex: 1;
  overflow-y: auto;
}

/* One snack row: picture on the left, then the name, then how many minutes. */
.snack-row {
  height: 144px;
  display: flex;
  align-items: center;
  border-bottom: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
}

/* The square box on the left of each row that holds the snack picture. */
.snack-icon-cell {
  flex: 0 0 140px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-icon-cell);
  border-right: var(--outline-width) solid var(--color-ink);
}

/* The snack's name, in capitals. */
.snack-name {
  flex: 1;
  padding: 0 16px;
  text-transform: uppercase;
  font-size: 16px;
}

/* The "25 MIN" text on the right, in grey. */
.snack-duration {
  padding: 0 16px;
  color: var(--color-text-muted);
  font-size: 14px;
}

/* The box with your all-time totals under the snack list, with a thick line on top. */
.stats-box {
  border-top: var(--outline-width-thick) solid var(--color-ink);
}

/* One line in that box: the label on the left, the number pushed to the right. */
.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: var(--outline-width) solid var(--color-ink);
  text-transform: uppercase;
  font-size: 13px;
}

/* No line under the very last row. */
.stats-row:last-child {
  border-bottom: none;
}

/* The Hive: hexagons lined up in rows that wrap onto the next line when full. */
.honeycomb {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 16px;
}

/* The list of past sessions under the filters. Scrolls when it gets long. */
.history-list {
  padding: 0 16px 16px;
  overflow-y: auto;
}

/* The row of filter boxes (date, description, snack, status). Wraps onto two lines if narrow. */
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 12px;
}

/* The look of each filter box. */
.filter-input {
  flex: 1;
  min-width: 90px;
  border: var(--outline-width) solid var(--color-ink);
  background: #fff8ea;
  padding: 4px 6px;
  font-family: var(--font-display);
  font-size: 11px;
}

/* The grey "No sessions match." message. */
.history-empty {
  color: var(--color-text-muted);
  font-size: 12px;
  padding: 8px 0;
}

/* One past session in the list: date, description, snack and status in a line. */
.history-row {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: var(--outline-width) solid var(--color-ink);
  font-size: 12px;
}

/* The date, in grey. */
.history-date {
  color: var(--color-text-muted);
}

/* The description stretches to fill whatever space is left in the row. */
.history-desc {
  flex: 1;
}

/* The snack name, in grey. */
.history-snack {
  color: var(--color-text-muted);
}

/* "completed" is shown in green... */
.history-status.completed {
  color: var(--color-dot-left);
}

/* ...and "cancelled" in pink-red. */
.history-status.cancelled {
  color: var(--color-rose);
}

/* The see-through dark layer that covers the whole app behind a popup, with the popup centred on top. */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(31, 26, 28, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* The popup box itself (the "are you sure?" question). */
.modal {
  background: var(--color-panel);
  border: var(--outline-width-thick) solid var(--color-ink);
  padding: 24px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
}

/* The row of buttons at the bottom of the popup. */
.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* The look of each popup button. */
.modal-actions button {
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-panel);
  padding: 8px 16px;
  cursor: pointer;
  text-transform: uppercase;
  font-family: var(--font-display);
  font-size: 12px;
}

/* The "Cancel session" / "Skip break" button is pink so it stands out. */
.modal-actions button.danger {
  background: var(--color-rose);
}
</style>
