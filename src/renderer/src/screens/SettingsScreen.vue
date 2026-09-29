<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings, SnackType, VaultStatus } from '../../../shared/types'
import { SNACK_LABELS, SNACK_ORDER } from '../../../shared/types'

// The Settings popup: pick your Obsidian vault folder and tweak how long
// each snack and the break last. Tells App.vue "close" when you hit the X.
defineEmits<{ close: [] }>()

const vaultStatus = ref<VaultStatus | null>(null) // your vault folder, and whether it still exists
const settings = ref<Settings | null>(null) // your snack + break lengths (empty until loaded)
const loadError = ref<string | null>(null) // an error message to show if something goes wrong

// Loads your current vault folder and lengths when the popup opens. If that
// fails, show the error instead of a blank screen.
async function loadAll(): Promise<void> {
  loadError.value = null
  try {
    vaultStatus.value = await window.api.getVaultStatus()
    settings.value = await window.api.getSettings()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to load settings:', error)
  }
}

// Load everything as soon as the popup appears.
onMounted(loadAll)

// Opens the folder picker. If you cancel, nothing changes.
async function chooseFolder(): Promise<void> {
  loadError.value = null
  try {
    const result = await window.api.chooseVaultFolder()
    if (result) vaultStatus.value = result
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to choose vault folder:', error)
  }
}

// These two save a new number as soon as you change it, but ignore anything
// that isn't a real positive number (like 0, a negative, or an empty box).
// Saves a new length for one snack.
async function updateSnackDuration(snack: SnackType, minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  settings.value = await window.api.setSnackDuration(snack, minutes)
}

// Saves a new break length.
async function updateBreakMinutes(minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  settings.value = await window.api.setBreakMinutes(minutes)
}
</script>

<template>
  <div class="settings-panel">
    <!-- Top row: title and the × close button -->
    <div class="settings-header">
      <span class="title">Settings</span>
      <button class="close-button" aria-label="Close settings" @click="$emit('close')">
        &times;
      </button>
    </div>

    <!-- A yellow warning, if needed: something broke, no folder picked yet, or the folder went missing -->
    <p v-if="loadError" class="warning-banner">Something went wrong: {{ loadError }}</p>
    <template v-else-if="vaultStatus">
      <p v-if="!vaultStatus.path" class="warning-banner">
        Choose your Obsidian vault so focus sessions get logged
      </p>
      <p v-else-if="!vaultStatus.exists" class="warning-banner">
        Your vault folder can't be found, choose it again
      </p>
    </template>

    <!-- Vault folder: shows the folder you picked and a button to pick another -->
    <div class="section">
      <p class="section-label">Obsidian vault folder</p>
      <p class="vault-path">{{ vaultStatus?.path ?? 'not chosen yet' }}</p>
      <button class="choose-button" @click="chooseFolder">Choose vault folder</button>
    </div>

    <!-- One number box per snack. It saves when you click away or press Enter -->
    <div v-if="settings" class="section">
      <p class="section-label">Snack durations (minutes)</p>
      <div v-for="snack in SNACK_ORDER" :key="snack" class="duration-row">
        <span>{{ SNACK_LABELS[snack] }}</span>
        <input
          type="number"
          min="1"
          :value="settings.snackDurations[snack]"
          @change="updateSnackDuration(snack, Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- The break length, saved the same way -->
    <div v-if="settings" class="section">
      <p class="section-label">Break length (minutes)</p>
      <input
        type="number"
        min="1"
        :value="settings.breakMinutes"
        @change="updateBreakMinutes(Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<style scoped>
/* The Settings popup box. If it's taller than the window, you can scroll inside it. */
.settings-panel {
  background: var(--color-panel);
  border: var(--outline-width-thick) solid var(--color-ink);
  width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* The top row: "Settings" on the left, the × close button on the right. */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* The "Settings" title. */
.title {
  text-transform: uppercase;
  font-size: 18px;
  letter-spacing: 0.02em;
}

/* The × close button: just the symbol, no box around it. */
.close-button {
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: var(--color-ink);
}

/* The pale yellow warning box (about the vault folder, or if something went wrong). */
.warning-banner {
  background: #fff3d6;
  border: var(--outline-width) solid var(--color-ink);
  padding: 8px 12px;
  font-size: 12px;
}

/* Each section of the popup, with a thin line above it to separate it from the one before. */
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: var(--outline-width) solid var(--color-ink);
  padding-top: 12px;
}

/* The small grey heading at the top of each section. */
.section-label {
  text-transform: uppercase;
  font-size: 13px;
  color: var(--color-text-muted);
}

/* The box showing your vault folder. Long folder paths wrap onto the next line. */
.vault-path {
  font-size: 12px;
  word-break: break-word;
  background: #fff8ea;
  border: var(--outline-width) solid var(--color-ink);
  padding: 6px 8px;
}

/* The yellow "Choose vault folder" button. */
.choose-button {
  align-self: flex-start;
  padding: 8px 16px;
  border: var(--outline-width) solid var(--color-ink);
  background: var(--color-honey);
  cursor: pointer;
  text-transform: uppercase;
  font-family: var(--font-display);
  font-size: 12px;
}

/* One snack line: the name on the left, its number box on the right. */
.duration-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

/* The small number boxes where you type the minutes. */
.duration-row input,
.section > input {
  width: 70px;
  border: var(--outline-width) solid var(--color-ink);
  padding: 4px 8px;
  font-family: var(--font-display);
  font-size: 13px;
  background: #fff8ea;
}
</style>
