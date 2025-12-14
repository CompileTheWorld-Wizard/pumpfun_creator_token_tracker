<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Header -->
    <header class="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-10">
      <div class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Scoring Settings
            </h1>
            <p class="text-gray-400 text-xs mt-0.5">Manage scoring system configuration</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="$router.push('/board')"
              class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
            >
              Back to Board
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Preset Management -->
      <div class="mb-6 bg-gray-900/80 border border-gray-800 rounded-lg p-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-100">Preset Management</h2>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedPresetId"
              @change="loadPreset"
              class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Select Preset --</option>
              <option v-for="preset in presets" :key="preset.id" :value="preset.id">
                {{ preset.name }} {{ preset.isDefault ? '(Default)' : '' }}
              </option>
            </select>
            <button
              @click="openSaveDialog"
              class="px-4 py-2 bg-green-600/90 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
            >
              {{ selectedPresetId ? 'Update Preset' : 'Save as Preset' }}
            </button>
            <button
              @click="showDeleteDialog = true"
              :disabled="!selectedPresetId || isSelectedPresetDefault"
              class="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
            <button
              @click="handleApplySettings"
              :disabled="applying"
              class="px-4 py-2 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span v-if="applying" class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              <span v-else>Apply Settings</span>
            </button>
          </div>
        </div>
        <div v-if="appliedPresetId" class="mt-3 text-sm">
          <span class="text-gray-400">Currently Applied: </span>
          <span class="text-green-400 font-semibold">
            {{ presets.find(p => p.id === appliedPresetId)?.name || 'Custom Settings' }}
          </span>
        </div>
      </div>

      <!-- Tracking Time -->
      <div class="mb-6 bg-gray-900/80 border border-gray-800 rounded-lg p-4">
        <h2 class="text-lg font-bold text-gray-100 mb-4">Tracking Time</h2>
        <div class="flex items-center gap-4">
          <label class="text-sm text-gray-300">New Token Tracking Duration (seconds):</label>
          <input
            v-model.number="settings.trackingTimeSeconds"
            type="number"
            min="15"
            max="120"
            class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-32"
          />
          <span class="text-xs text-gray-500">Min: 15s, Max: 120s</span>
        </div>
      </div>

      <!-- Metrics Grid (2 columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Win Rate -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-100">Win Rate (0-100%)</h2>
          <button
            @click="addRange('winRate')"
            class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
          >
            Add Range
          </button>
        </div>
        <div class="space-y-2">
          <div
            v-for="(range, index) in settings.winRate"
            :key="index"
            class="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"
          >
            <input
              v-model.number="range.min"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Min %"
              class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
            />
            <span class="text-gray-400">-</span>
            <input
              v-model.number="range.max"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Max %"
              class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
            />
            <span class="text-gray-400">:</span>
            <input
              v-model.number="range.score"
              type="number"
              step="0.1"
              placeholder="Score"
              class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
            />
            <button
              @click="removeRange('winRate', index)"
              class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
            >
              Remove
            </button>
          </div>
          <p v-if="settings.winRate.length === 0" class="text-sm text-gray-500 text-center py-4">
            No ranges configured. Click "Add Range" to add one.
          </p>
        </div>
      </div>

        <!-- Avg ATH MCap -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-100">Average ATH Market Cap (Percentile)</h2>
            <button
              @click="addRange('avgAthMcap')"
              class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Add Range
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(range, index) in settings.avgAthMcap"
              :key="index"
              class="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"
            >
              <input
                v-model.number="range.min"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Min percentile"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <span class="text-gray-400">-</span>
              <input
                v-model.number="range.max"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Max percentile"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <span class="text-gray-400">:</span>
              <input
                v-model.number="range.score"
                type="number"
                step="0.1"
                placeholder="Score"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <button
                @click="removeRange('avgAthMcap', index)"
                class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
              >
                Remove
              </button>
            </div>
            <p v-if="settings.avgAthMcap.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured. Click "Add Range" to add one.
            </p>
          </div>
        </div>

        <!-- Median ATH MCap -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-100">Median ATH Market Cap (Percentile)</h2>
            <button
              @click="addRange('medianAthMcap')"
              class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Add Range
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(range, index) in settings.medianAthMcap"
              :key="index"
              class="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"
            >
              <input
                v-model.number="range.min"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Min percentile"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <span class="text-gray-400">-</span>
              <input
                v-model.number="range.max"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Max percentile"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <span class="text-gray-400">:</span>
              <input
                v-model.number="range.score"
                type="number"
                step="0.1"
                placeholder="Score"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <button
                @click="removeRange('medianAthMcap', index)"
                class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
              >
                Remove
              </button>
            </div>
            <p v-if="settings.medianAthMcap.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured. Click "Add Range" to add one.
            </p>
          </div>
        </div>

        <!-- Avg Rug Rate -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-100">Average Rug Rate (%)</h2>
            <button
              @click="addRange('avgRugRate')"
              class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Add Range
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(range, index) in settings.avgRugRate"
              :key="index"
              class="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"
            >
              <input
                v-model.number="range.min"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Min %"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
              />
              <span class="text-gray-400">-</span>
              <input
                v-model.number="range.max"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Max %"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
              />
              <span class="text-gray-400">:</span>
              <input
                v-model.number="range.score"
                type="number"
                step="0.1"
                placeholder="Score"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <button
                @click="removeRange('avgRugRate', index)"
                class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
              >
                Remove
              </button>
            </div>
            <p v-if="settings.avgRugRate.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured. Click "Add Range" to add one.
            </p>
          </div>
        </div>

        <!-- Avg Rug Rate by Time Bucket -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-100">Average Rug Rate by Time Bucket (seconds)</h2>
            <button
              @click="addTimeBucketRange"
              class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Add Range
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(range, index) in settings.avgRugRateByTimeBucket"
              :key="index"
              class="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"
            >
              <input
                v-model.number="range.min"
                type="number"
                min="0"
                step="0.1"
                placeholder="Min seconds"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <span class="text-gray-400">-</span>
              <input
                v-model.number="range.max"
                type="number"
                min="0"
                step="0.1"
                placeholder="Max seconds"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <span class="text-gray-400">:</span>
              <input
                v-model.number="range.score"
                type="number"
                step="0.1"
                placeholder="Score"
                class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
              />
              <button
                @click="removeTimeBucketRange(index)"
                class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
              >
                Remove
              </button>
            </div>
            <p v-if="settings.avgRugRateByTimeBucket.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured. Click "Add Range" to add one.
            </p>
          </div>
        </div>
      </div>

      <!-- Multiplier Configs (Full Width) -->
      <div class="mt-6 bg-gray-900/80 border border-gray-800 rounded-lg p-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-100">% of Tokens That At Least "X"x From Starting MCAP</h2>
          <button
            @click="addMultiplierConfig"
            class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
          >
            Add Multiplier
          </button>
        </div>
        <div class="space-y-4">
          <div
            v-for="(config, configIndex) in settings.multiplierConfigs"
            :key="configIndex"
            class="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <label class="text-sm text-gray-300">Multiplier:</label>
                <input
                  v-model.number="config.multiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="e.g., 1.5, 2, 3"
                  class="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
                />
                <span class="text-xs text-gray-500">x</span>
              </div>
              <button
                @click="removeMultiplierConfig(configIndex)"
                class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
              >
                Remove Multiplier
              </button>
            </div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-400">Ranges:</span>
              <button
                @click="addRangeToMultiplier(configIndex)"
                class="px-2 py-1 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold rounded transition"
              >
                Add Range
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="(range, rangeIndex) in config.ranges"
                :key="rangeIndex"
                class="flex items-center gap-2 p-2 bg-gray-900/50 rounded"
              >
                <input
                  v-model.number="range.min"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Min %"
                  class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 w-20"
                />
                <span class="text-gray-500 text-xs">-</span>
                <input
                  v-model.number="range.max"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Max %"
                  class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 w-20"
                />
                <span class="text-gray-500 text-xs">:</span>
                <input
                  v-model.number="range.score"
                  type="number"
                  step="0.1"
                  placeholder="Score"
                  class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
                />
                <button
                  @click="removeRangeFromMultiplier(configIndex, rangeIndex)"
                  class="px-2 py-1 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded transition"
                >
                  Remove
                </button>
              </div>
              <p v-if="config.ranges.length === 0" class="text-xs text-gray-500 text-center py-2">
                No ranges configured. Click "Add Range" to add one.
              </p>
            </div>
          </div>
          <p v-if="settings.multiplierConfigs.length === 0" class="text-sm text-gray-500 text-center py-4">
            No multiplier configurations. Click "Add Multiplier" to add one.
          </p>
        </div>
      </div>

    </main>

    <!-- Save Preset Dialog -->
    <div
      v-if="showSaveDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showSaveDialog = false"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Save Preset</h3>
          <button
            @click="showSaveDialog = false"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleSavePreset" class="space-y-4">
          <div>
            <label for="presetName" class="block text-sm font-semibold text-gray-300 mb-1.5">
              Preset Name
            </label>
            <input
              id="presetName"
              v-model="presetName"
              type="text"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
              placeholder="Enter preset name"
            />
          </div>
          <div>
            <label class="flex items-center gap-2">
              <input
                v-model="saveAsDefault"
                type="checkbox"
                class="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded focus:ring-purple-500"
              />
              <span class="text-sm text-gray-300">Set as default preset</span>
            </label>
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              @click="showSaveDialog = false"
              class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="saving">Saving...</span>
              <span v-else>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Preset Dialog -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-gray-900 border border-red-500/50 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-red-400">Delete Preset</h3>
          <button
            @click="showDeleteDialog = false"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div v-if="isSelectedPresetDefault" class="bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4">
          <p class="text-sm font-semibold">⚠️ Cannot delete default preset</p>
          <p class="text-xs text-red-200 mt-1">
            The default preset cannot be deleted. Please set another preset as default first.
          </p>
        </div>
        <p v-else class="text-sm text-gray-300 mb-4">
          Are you sure you want to delete this preset? This action cannot be undone.
        </p>
        <div class="flex gap-3">
          <button
            @click="showDeleteDialog = false"
            class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            @click="handleDeletePreset"
            :disabled="deleting || isSelectedPresetDefault"
            class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="deleting">Deleting...</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getScoringPresets,
  getScoringPreset,
  createScoringPreset,
  updateScoringPreset,
  deleteScoringPreset,
  getAppliedSettings,
  applySettings,
  type ScoringSettings,
  type ScoringPreset
} from '../services/settings'

const presets = ref<ScoringPreset[]>([])
const selectedPresetId = ref<number | ''>('')
const appliedPresetId = ref<number | null>(null)
const showSaveDialog = ref(false)
const showDeleteDialog = ref(false)
const presetName = ref('')
const saveAsDefault = ref(false)
const saving = ref(false)
const deleting = ref(false)
const applying = ref(false)

const isSelectedPresetDefault = computed(() => {
  if (!selectedPresetId.value) return false
  const preset = presets.value.find(p => p.id === selectedPresetId.value)
  return preset?.isDefault || false
})

const settings = ref<ScoringSettings>({
  trackingTimeSeconds: 15,
  winRate: [],
  avgAthMcap: [],
  medianAthMcap: [],
  multiplierConfigs: [],
  avgRugRate: [],
  avgRugRateByTimeBucket: []
})

const addRange = (type: 'winRate' | 'avgAthMcap' | 'medianAthMcap' | 'avgRugRate') => {
  settings.value[type].push({ min: 0, max: 100, score: 0 })
}

const removeRange = (type: 'winRate' | 'avgAthMcap' | 'medianAthMcap' | 'avgRugRate', index: number) => {
  settings.value[type].splice(index, 1)
}

const addMultiplierConfig = () => {
  settings.value.multiplierConfigs.push({
    multiplier: 1.5,
    ranges: []
  })
}

const removeMultiplierConfig = (index: number) => {
  settings.value.multiplierConfigs.splice(index, 1)
}

const addRangeToMultiplier = (configIndex: number) => {
  settings.value.multiplierConfigs[configIndex].ranges.push({ min: 0, max: 100, score: 0 })
}

const removeRangeFromMultiplier = (configIndex: number, rangeIndex: number) => {
  settings.value.multiplierConfigs[configIndex].ranges.splice(rangeIndex, 1)
}

const addTimeBucketRange = () => {
  settings.value.avgRugRateByTimeBucket.push({ min: 0, max: 120, score: 0 })
}

const removeTimeBucketRange = (index: number) => {
  settings.value.avgRugRateByTimeBucket.splice(index, 1)
}

const loadPreset = async () => {
  if (!selectedPresetId.value) {
    // Reset to default settings when no preset is selected
    settings.value = {
      trackingTimeSeconds: 15,
      winRate: [],
      avgAthMcap: [],
      medianAthMcap: [],
      multiplierConfigs: [],
      avgRugRate: [],
      avgRugRateByTimeBucket: []
    }
    presetName.value = ''
    saveAsDefault.value = false
    return
  }

  try {
    const preset = await getScoringPreset(selectedPresetId.value as number)
    settings.value = { ...preset.settings }
    presetName.value = preset.name
    saveAsDefault.value = preset.isDefault
  } catch (error: any) {
    alert(error.message || 'Failed to load preset')
  }
}

const openSaveDialog = () => {
  if (selectedPresetId.value) {
    // If updating, preset name should already be loaded
    const preset = presets.value.find(p => p.id === selectedPresetId.value)
    if (preset) {
      presetName.value = preset.name
      saveAsDefault.value = preset.isDefault
    }
  } else {
    presetName.value = ''
    saveAsDefault.value = false
  }
  showSaveDialog.value = true
}

const handleSavePreset = async () => {
  if (!presetName.value.trim()) {
    alert('Please enter a preset name')
    return
  }

  // Validate tracking time
  if (settings.value.trackingTimeSeconds < 15 || settings.value.trackingTimeSeconds > 120) {
    alert('Tracking time must be between 15 and 120 seconds')
    return
  }

  saving.value = true
  try {
    if (selectedPresetId.value) {
      // Update existing preset
      await updateScoringPreset(selectedPresetId.value as number, {
        name: presetName.value,
        settings: settings.value,
        isDefault: saveAsDefault.value
      })
    } else {
      // Create new preset
      const newPreset = await createScoringPreset(presetName.value, settings.value, saveAsDefault.value)
      selectedPresetId.value = newPreset.id
    }
    
    await loadPresets()
    showSaveDialog.value = false
    alert('Preset saved successfully!')
  } catch (error: any) {
    alert(error.message || 'Failed to save preset')
  } finally {
    saving.value = false
  }
}

const handleDeletePreset = async () => {
  if (!selectedPresetId.value) {
    return
  }

  // Prevent deletion of default preset
  if (isSelectedPresetDefault.value) {
    alert('Cannot delete the default preset. Please set another preset as default first.')
    showDeleteDialog.value = false
    return
  }

  deleting.value = true
  try {
    await deleteScoringPreset(selectedPresetId.value as number)
    await loadPresets()
    selectedPresetId.value = ''
    showDeleteDialog.value = false
    // Reset to default settings
    settings.value = {
      trackingTimeSeconds: 15,
      winRate: [],
      avgAthMcap: [],
      medianAthMcap: [],
      multiplierConfigs: [],
      avgRugRate: [],
      avgRugRateByTimeBucket: []
    }
    alert('Preset deleted successfully!')
  } catch (error: any) {
    alert(error.message || 'Failed to delete preset')
  } finally {
    deleting.value = false
  }
}

const loadPresets = async () => {
  try {
    presets.value = await getScoringPresets()
  } catch (error: any) {
    console.error('Error loading presets:', error)
  }
}

const loadAppliedSettings = async () => {
  try {
    const applied = await getAppliedSettings()
    appliedPresetId.value = applied.presetId
    // If there are applied settings, load them into the form
    if (applied.settings) {
      settings.value = { ...applied.settings }
      if (applied.presetId) {
        selectedPresetId.value = applied.presetId
      }
    }
  } catch (error: any) {
    console.error('Error loading applied settings:', error)
    // If no applied settings, load default preset
    try {
      const defaultPresetItem = presets.value.find(p => p.isDefault)
      if (defaultPresetItem) {
        selectedPresetId.value = defaultPresetItem.id
        await loadPreset()
        // Auto-apply default preset on first load
        await handleApplySettings()
      }
    } catch (err: any) {
      console.error('Error loading default preset:', err)
    }
  }
}

const handleApplySettings = async () => {
  // Validate tracking time
  if (settings.value.trackingTimeSeconds < 15 || settings.value.trackingTimeSeconds > 120) {
    alert('Tracking time must be between 15 and 120 seconds')
    return
  }

  applying.value = true
  try {
    const applied = await applySettings(settings.value, selectedPresetId.value as number | undefined)
    appliedPresetId.value = applied.presetId
    alert('Settings applied successfully!')
  } catch (error: any) {
    alert(error.message || 'Failed to apply settings')
  } finally {
    applying.value = false
  }
}

onMounted(async () => {
  await loadPresets()
  await loadAppliedSettings()
})
</script>

