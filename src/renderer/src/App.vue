<script setup lang="ts">
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
const vaultStatus = ref<VaultStatus | null>(null)
async function loadVaultStatus(): Promise<void> {
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    console.error('Failed to load vault status:', error)
  }
}

// ---------------------------------------------------------------------------
// Settings popup (opened with Cmd+,).
const showSettings = ref(false)
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
const breakMinutes = ref(5)
const stats = ref({ totalSessions: 0, totalFocusMinutes: 0 }) // all-time totals under the snack menu
const rightView = ref<'snacks' | 'hive'>('snacks') // which page the right panel is showing
const history = ref<Session[]>([]) // every past session, for the Hive
const showCancelConfirm = ref(false) // the "are you sure?" popup
const descriptionError = ref(false) // turns on when you try to start without typing anything
// Hive filters (left empty = show everything).
const filterDate = ref('')
const filterDescription = ref('')
const filterSnack = ref<SnackType | ''>('')
const filterStatus = ref<'completed' | 'cancelled' | ''>('')

// The once-a-second timers for focus and break. We keep hold of them so we
// can stop them later.
let tickHandle: ReturnType<typeof setInterval> | null = null
let breakHandle: ReturnType<typeof setInterval> | null = null

// These three ask the backstage (main/index.ts) for fresh data and keep it.
async function loadSettings(): Promise<void> {
  const settings = await window.api.getSettings()
  snackDurations.value = settings.snackDurations
  breakMinutes.value = settings.breakMinutes
}

async function loadStats(): Promise<void> {
  stats.value = await window.api.getStats()
}

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
  stopTicking()
  elapsedSeconds.value = session.elapsedSeconds
  let sinceLastPersist = 0
  tickHandle = setInterval(async () => {
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
    stopTicking()
    const updated = await window.api.pauseSession(activeSession.value.id, elapsedSeconds.value)
    activeSession.value = updated
  } else if (activeSession.value.status === 'paused') {
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
  window.electron.ipcRenderer.on('open-settings', openSettingsFromMenu)
})

// Tidy up when the screen closes so nothing keeps running in the background.
onUnmounted(() => {
  stopTicking()
  if (breakHandle) clearInterval(breakHandle)
  window.electron.ipcRenderer.removeListener('open-settings', openSettingsFromMenu)
})
</script>

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
            <span class="timer">{{ timerLabel }}</span>
          </div>
          <!-- The big button changes depending on the state: on break / pause / resume / take a break / done -->
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

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vault-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-ink);
  padding: 8px 14px;
  font-size: 13px;
}

.panels {
  flex: 1;
  display: flex;
  gap: 32px;
  min-height: 0;
}

.panel {
  background: var(--color-panel);
  border: var(--outline-width) solid var(--color-ink);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-left {
  flex: 0 0 65%;
}

.panel-right {
  flex: 1;
}

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

.bee-drop-target {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Fill the space between the header and the timer so the bee can shrink to fit. */
  flex: 1;
  min-height: 0;
  width: 100%;
}

.prompt-label {
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-muted);
  font-size: 14px;
}

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

.description-input::placeholder {
  color: var(--color-placeholder);
}

.description-input.error {
  border-bottom-color: var(--color-rose);
}

.description-error {
  color: var(--color-rose);
  font-size: 12px;
}

.bottom-bar {
  height: 190px;
  min-height: 190px;
  border-top: var(--outline-width-thick) solid var(--color-ink);
  display: flex;
}

.timer-side {
  flex: 0 0 62%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

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

.reset-icon:hover {
  background: var(--color-snack-honey-drop);
}

/* Invisible but still taking up space, so the timer doesn't jump around when it appears. */
.reset-icon.hidden {
  visibility: hidden;
}

.timer {
  font-family: var(--font-timer);
  font-size: 88px;
  line-height: 1;
}

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

.action-button.start {
  background: var(--color-honey);
}

.action-button.pause {
  background: var(--color-rose);
}

.action-button.break-active {
  background: var(--color-icon-cell);
  cursor: default;
}

.right-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

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

.hive-toggle {
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-panel);
  padding: 6px 12px;
  text-transform: uppercase;
  font-family: var(--font-display);
  font-size: 12px;
  cursor: pointer;
}

.snack-list {
  flex: 1;
  overflow-y: auto;
}

.snack-row {
  height: 144px;
  display: flex;
  align-items: center;
  border-bottom: var(--outline-width) solid var(--color-ink);
  cursor: pointer;
}

.snack-icon-cell {
  flex: 0 0 140px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-icon-cell);
  border-right: var(--outline-width) solid var(--color-ink);
}

.snack-name {
  flex: 1;
  padding: 0 16px;
  text-transform: uppercase;
  font-size: 16px;
}

.snack-duration {
  padding: 0 16px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.stats-box {
  border-top: var(--outline-width-thick) solid var(--color-ink);
}

.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: var(--outline-width) solid var(--color-ink);
  text-transform: uppercase;
  font-size: 13px;
}

.stats-row:last-child {
  border-bottom: none;
}

.honeycomb {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 16px;
}

.history-list {
  padding: 0 16px 16px;
  overflow-y: auto;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 12px;
}

.filter-input {
  flex: 1;
  min-width: 90px;
  border: var(--outline-width) solid var(--color-ink);
  background: #fff8ea;
  padding: 4px 6px;
  font-family: var(--font-display);
  font-size: 11px;
}

.history-empty {
  color: var(--color-text-muted);
  font-size: 12px;
  padding: 8px 0;
}

.history-row {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: var(--outline-width) solid var(--color-ink);
  font-size: 12px;
}

.history-date {
  color: var(--color-text-muted);
}

.history-desc {
  flex: 1;
}

.history-snack {
  color: var(--color-text-muted);
}

.history-status.completed {
  color: var(--color-dot-left);
}

.history-status.cancelled {
  color: var(--color-rose);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(31, 26, 28, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

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

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-actions button {
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-panel);
  padding: 8px 16px;
  cursor: pointer;
  text-transform: uppercase;
  font-family: var(--font-display);
  font-size: 12px;
}

.modal-actions button.danger {
  background: var(--color-rose);
}
</style>
