<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { BeeMood, Session, SnackType, VaultStatus } from '../../shared/types'
import { SNACK_LABELS, SNACK_ORDER } from '../../shared/types'
import Bee from './components/Bee.vue'
import PanelHeader from './components/PanelHeader.vue'
import SnackIcon from './components/SnackIcon.vue'
import Hexagon from './components/Hexagon.vue'
import SettingsScreen from './screens/SettingsScreen.vue'

// ---------------------------------------------------------------------------
// Vault status banner (shown across the whole app, not just Settings) —
// core features must keep working even with no/broken vault (PRD §Vault
// selection acceptance criteria).
const vaultStatus = ref<VaultStatus | null>(null)
async function loadVaultStatus(): Promise<void> {
  try {
    vaultStatus.value = await window.api.getVaultStatus()
  } catch (error) {
    console.error('Failed to load vault status:', error)
  }
}

// ---------------------------------------------------------------------------
// Settings overlay (Cmd+,).
const showSettings = ref(false)
function openSettingsFromMenu(): void {
  showSettings.value = true
}
function closeSettings(): void {
  showSettings.value = false
  loadVaultStatus()
  loadSettings()
}

// ---------------------------------------------------------------------------
// Session state.
const activeSession = ref<Session | null>(null)
const description = ref('')
const elapsedSeconds = ref(0)
const isOnBreak = ref(false)
const breakRemaining = ref(0)
const snackDurations = ref<Record<SnackType, number>>({
  pollen: 15,
  'honey-drop': 25,
  flower: 45,
  'honey-jar': 90
})
const breakMinutes = ref(5)
const stats = ref({ totalSessions: 0, totalFocusMinutes: 0 })
const rightView = ref<'snacks' | 'hive'>('snacks')
const history = ref<Session[]>([])
const showCancelConfirm = ref(false)
const descriptionError = ref(false)
const filterDate = ref('')
const filterDescription = ref('')
const filterSnack = ref<SnackType | ''>('')
const filterStatus = ref<'completed' | 'cancelled' | ''>('')

let tickHandle: ReturnType<typeof setInterval> | null = null
let breakHandle: ReturnType<typeof setInterval> | null = null

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

const mood = computed<BeeMood>(() => {
  if (isOnBreak.value) return 'break'
  if (!activeSession.value) return 'idle'
  if (activeSession.value.status === 'paused') return 'paused'
  if (activeSession.value.status === 'completed') return 'completed'
  if (activeSession.value.status === 'cancelled') return 'cancelled'
  return 'focus'
})

const remainingSeconds = computed(() => {
  if (!activeSession.value) return 0
  return Math.max(0, activeSession.value.plannedSeconds - elapsedSeconds.value)
})

const focusProgress = computed<number | null>(() => {
  if (isOnBreak.value) {
    if (!breakMinutes.value) return null
    const totalBreakSeconds = breakMinutes.value * 60
    return totalBreakSeconds > 0
      ? Math.min(1, (totalBreakSeconds - breakRemaining.value) / totalBreakSeconds)
      : null
  }
  if (!activeSession.value || activeSession.value.plannedSeconds <= 0) return null
  return Math.min(1, elapsedSeconds.value / activeSession.value.plannedSeconds)
})

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const timerLabel = computed(() =>
  isOnBreak.value ? formatClock(breakRemaining.value) : formatClock(remainingSeconds.value)
)

// After a session ends (completed/cancelled), briefly show its result mood
// before returning to idle — "cancelling ends the session ... then returns
// to idle" (PRD §4.2).
let endedResultTimeout: ReturnType<typeof setTimeout> | null = null
const showTakeBreak = ref(false)

function stopTicking(): void {
  if (tickHandle) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

async function startTicking(session: Session): Promise<void> {
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

async function loadActiveSession(): Promise<void> {
  const session = await window.api.getActiveSession()
  activeSession.value = session
  if (session) {
    description.value = session.description
    elapsedSeconds.value = session.elapsedSeconds
    if (session.status === 'running') startTicking(session)
  }
}

function validateDescription(): boolean {
  if (!description.value.trim()) {
    descriptionError.value = true
    return false
  }
  descriptionError.value = false
  return true
}

async function startWithSnack(snack: SnackType): Promise<void> {
  if (activeSession.value) return
  if (!validateDescription()) return
  const created = await window.api.startSession({ snack, description: description.value.trim() })
  activeSession.value = created
  elapsedSeconds.value = 0
  showTakeBreak.value = false
  startTicking(created)
}

function onSnackDragStart(event: DragEvent, snack: SnackType): void {
  event.dataTransfer?.setData('text/plain', snack)
}

function onBeeDrop(event: DragEvent): void {
  event.preventDefault()
  const snack = event.dataTransfer?.getData('text/plain') as SnackType | undefined
  if (snack) startWithSnack(snack)
}

function onBeeDragOver(event: DragEvent): void {
  event.preventDefault()
}

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

function requestCancel(): void {
  if (isOnBreak.value) {
    showCancelConfirm.value = true
    return
  }
  if (!activeSession.value) return
  showCancelConfirm.value = true
}

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

function dismissCancel(): void {
  showCancelConfirm.value = false
}

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

function stopBreak(): void {
  if (breakHandle) {
    clearInterval(breakHandle)
    breakHandle = null
  }
  isOnBreak.value = false
  resetToIdle()
}

function snackColor(snack: SnackType): string {
  return `var(--color-snack-${snack})`
}

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

function toggleRightView(): void {
  rightView.value = rightView.value === 'hive' ? 'snacks' : 'hive'
  loadHistory()
}

onMounted(async () => {
  loadVaultStatus()
  await loadSettings()
  await loadStats()
  await loadHistory()
  await loadActiveSession()
  window.electron.ipcRenderer.on('open-settings', openSettingsFromMenu)
})

onUnmounted(() => {
  stopTicking()
  if (breakHandle) clearInterval(breakHandle)
  window.electron.ipcRenderer.removeListener('open-settings', openSettingsFromMenu)
})
</script>

<template>
  <div class="app-shell">
    <p v-if="vaultStatus && !vaultStatus.path" class="vault-banner">
      Logging is not configured yet — choose an Obsidian vault in Settings (Cmd+,)
    </p>
    <p v-else-if="vaultStatus && !vaultStatus.exists" class="vault-banner">
      Your vault folder can't be found — logging is currently failing. Choose it again in Settings
    </p>

    <div class="panels">
      <!-- LEFT PANEL: FOCUS TIME -->
      <section class="panel panel-left">
        <PanelHeader
          label="Focus Time"
          dot-color="var(--color-dot-left)"
          :progress="focusProgress"
        />

        <div class="left-body">
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
          <template v-else>
            <div class="bee-drop-target" @dragover="onBeeDragOver" @drop="onBeeDrop">
              <Bee :mood="mood" />
            </div>
          </template>
        </div>

        <div class="bottom-bar">
          <div class="timer-side">
            <button
              class="reset-icon"
              aria-label="Cancel session"
              :disabled="
                !isOnBreak &&
                (!activeSession ||
                  activeSession.status === 'completed' ||
                  activeSession.status === 'cancelled')
              "
              @click="requestCancel"
            >
              &#8635;
            </button>
            <span class="timer">{{ timerLabel }}</span>
          </div>
          <button v-if="isOnBreak" class="action-button break-active" disabled>On break</button>
          <button
            v-else-if="!activeSession"
            class="action-button start"
            style="visibility: hidden"
            @click="startWithSnack('pollen')"
          >
            Start
          </button>
          <button
            v-else-if="activeSession.status === 'running'"
            class="action-button pause"
            @click="pauseOrResume"
          >
            Pause
          </button>
          <button
            v-else-if="activeSession.status === 'paused'"
            class="action-button start"
            @click="pauseOrResume"
          >
            Resume
          </button>
          <button
            v-else-if="activeSession.status === 'completed' && showTakeBreak"
            class="action-button start"
            @click="startBreak"
          >
            Take a break
          </button>
          <button v-else class="action-button pause" disabled>
            {{ activeSession?.status === 'completed' ? 'Completed' : 'Cancelled' }}
          </button>
        </div>
      </section>

      <!-- RIGHT PANEL -->
      <section class="panel panel-right">
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
          <template v-if="activeSession && !isOnBreak">
            <p class="working-on">{{ activeSession.description }}</p>
          </template>

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

    <div v-if="showCancelConfirm" class="modal-overlay">
      <div class="modal">
        <p v-if="isOnBreak">Skip this break and go back to idle?</p>
        <p v-else>Cancel this session? Progress will be recorded as cancelled.</p>
        <div class="modal-actions">
          <button @click="dismissCancel">Keep going</button>
          <button class="danger" @click="confirmCancel">
            {{ isOnBreak ? 'Skip break' : 'Cancel session' }}
          </button>
        </div>
      </div>
    </div>

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
  color: var(--color-ink);
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
}

.bee-drop-target {
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  opacity: 0.6;
  font-size: 22px;
  cursor: pointer;
}

.reset-icon:disabled {
  cursor: default;
  opacity: 0.25;
}

.timer {
  font-family: var(--font-timer);
  font-size: 88px;
  color: var(--color-ink);
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
  min-height: 144px;
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
