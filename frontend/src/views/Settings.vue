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
              <option v-for="preset in presets" :key="preset.id" :value="preset.id">
                {{ preset.name }} {{ preset.isDefault ? '(Default)' : '' }}
              </option>
            </select>
            <button
              @click="handleNewPreset"
              class="px-4 py-2 bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition"
            >
              New Preset
            </button>
            <button
              @click="showEditDialog = true"
              :disabled="!selectedPresetId || isSelectedPresetDefault"
              class="px-4 py-2 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit Settings
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

      <!-- Display Settings (Read-Only) -->
      <div v-if="selectedPresetId || appliedPresetId" class="space-y-6">
        <!-- Tracking Time -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
          <h2 class="text-lg font-bold text-gray-100 mb-4">Tracking Time</h2>
          <div class="text-sm text-gray-300">
            <span class="font-semibold">{{ displaySettings.trackingTimeSeconds }}</span> seconds
            <span class="text-gray-500 ml-2">(Min: 15s, Max: 120s)</span>
          </div>
        </div>

        <!-- Metrics Grid (2 columns) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Win Rate -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Win Rate (0-100%)</h2>
              <span v-if="displaySettings.winRate.name" class="text-sm text-purple-400 font-semibold">
                Name: {{ displaySettings.winRate.name }}
              </span>
            </div>
            <div v-if="displaySettings.winRate.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(range, index) in displaySettings.winRate.ranges"
                :key="index"
                class="p-3 bg-gray-800/50 rounded-lg text-sm"
              >
                <span class="text-gray-300">{{ range.min }}%</span>
                <span class="text-gray-500 mx-2">-</span>
                <span class="text-gray-300">{{ range.max }}%</span>
                <span class="text-gray-500 mx-2">:</span>
                <span class="text-purple-400 font-semibold">Score {{ range.score }}</span>
              </div>
            </div>
          </div>

          <!-- Avg ATH MCap -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Average ATH Market Cap (Percentile)</h2>
              <span v-if="displaySettings.avgAthMcap.name" class="text-sm text-purple-400 font-semibold">
                Name: {{ displaySettings.avgAthMcap.name }}
              </span>
            </div>
            <div v-if="displaySettings.avgAthMcap.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(range, index) in displaySettings.avgAthMcap.ranges"
                :key="index"
                class="p-3 bg-gray-800/50 rounded-lg text-sm"
              >
                <span class="text-gray-300">{{ range.min }}th</span>
                <span class="text-gray-500 mx-2">-</span>
                <span class="text-gray-300">{{ range.max }}th</span>
                <span class="text-gray-500 mx-2">:</span>
                <span class="text-purple-400 font-semibold">Score {{ range.score }}</span>
              </div>
            </div>
          </div>

          <!-- Median ATH MCap -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Median ATH Market Cap (Percentile)</h2>
              <span v-if="displaySettings.medianAthMcap.name" class="text-sm text-purple-400 font-semibold">
                Name: {{ displaySettings.medianAthMcap.name }}
              </span>
            </div>
            <div v-if="displaySettings.medianAthMcap.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(range, index) in displaySettings.medianAthMcap.ranges"
                :key="index"
                class="p-3 bg-gray-800/50 rounded-lg text-sm"
              >
                <span class="text-gray-300">{{ range.min }}th</span>
                <span class="text-gray-500 mx-2">-</span>
                <span class="text-gray-300">{{ range.max }}th</span>
                <span class="text-gray-500 mx-2">:</span>
                <span class="text-purple-400 font-semibold">Score {{ range.score }}</span>
              </div>
            </div>
          </div>

          <!-- Avg Rug Rate -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Average Rug Rate (%)</h2>
              <span v-if="displaySettings.avgRugRate.name" class="text-sm text-purple-400 font-semibold">
                Name: {{ displaySettings.avgRugRate.name }}
              </span>
            </div>
            <div v-if="displaySettings.avgRugRate.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(range, index) in displaySettings.avgRugRate.ranges"
                :key="index"
                class="p-3 bg-gray-800/50 rounded-lg text-sm"
              >
                <span class="text-gray-300">{{ range.min }}%</span>
                <span class="text-gray-500 mx-2">-</span>
                <span class="text-gray-300">{{ range.max }}%</span>
                <span class="text-gray-500 mx-2">:</span>
                <span class="text-red-400 font-semibold">Score {{ range.score }}</span>
              </div>
            </div>
          </div>

          <!-- Avg Rug Rate by Time Bucket -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Average Rug Rate by Time Bucket (seconds)</h2>
              <span v-if="displaySettings.avgRugRateByTimeBucket.name" class="text-sm text-purple-400 font-semibold">
                Name: {{ displaySettings.avgRugRateByTimeBucket.name }}
              </span>
            </div>
            <div v-if="displaySettings.avgRugRateByTimeBucket.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
              No ranges configured
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(range, index) in displaySettings.avgRugRateByTimeBucket.ranges"
                :key="index"
                class="p-3 bg-gray-800/50 rounded-lg text-sm"
              >
                <span class="text-gray-300">{{ range.min }}s</span>
                <span class="text-gray-500 mx-2">-</span>
                <span class="text-gray-300">{{ range.max }}s</span>
                <span class="text-gray-500 mx-2">:</span>
                <span class="text-red-400 font-semibold">Score {{ range.score }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Multiplier Configs (Full Width) -->
        <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
          <h2 class="text-lg font-bold text-gray-100 mb-4">% of Tokens That At Least "X"x From Starting MCAP</h2>
          <div v-if="displaySettings.multiplierConfigs.length === 0" class="text-sm text-gray-500 text-center py-4">
            No multiplier configurations
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="(config, configIndex) in displaySettings.multiplierConfigs"
              :key="configIndex"
              class="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
            >
              <h3 class="text-md font-semibold text-gray-200 mb-3">
                Multiplier: <span class="text-purple-400">{{ config.multiplier }}x</span>
              </h3>
              <div v-if="config.ranges.length === 0" class="text-xs text-gray-500 text-center py-2">
                No ranges configured
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(range, rangeIndex) in config.ranges"
                  :key="rangeIndex"
                  class="p-2 bg-gray-900/50 rounded text-xs"
                >
                  <span class="text-gray-300">{{ range.min }}%</span>
                  <span class="text-gray-500 mx-1">-</span>
                  <span class="text-gray-300">{{ range.max }}%</span>
                  <span class="text-gray-500 mx-1">:</span>
                  <span class="text-purple-400 font-semibold">Score {{ range.score }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="bg-gray-900/80 border border-gray-800 rounded-lg p-8 text-center">
        <p class="text-gray-400 text-sm mb-4">No preset selected. Please select a preset or create a new one.</p>
      </div>
    </main>

    <!-- Edit Settings Dialog -->
    <div
      v-if="showEditDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="showEditDialog = false"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-7xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-100">Edit Settings</h3>
          <button
            @click="showEditDialog = false"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Tracking Time -->
        <div class="mb-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h2 class="text-lg font-bold text-gray-100 mb-4">Tracking Time</h2>
          <div class="flex items-center gap-4">
            <label class="text-sm text-gray-300">New Token Tracking Duration (seconds):</label>
            <input
              v-model.number="editSettings.trackingTimeSeconds"
              type="number"
              min="15"
              max="120"
              class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-32"
            />
            <span class="text-xs text-gray-500">Min: 15s, Max: 120s</span>
          </div>
        </div>

        <!-- Metrics Grid (2 columns) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Win Rate -->
          <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Win Rate (0-100%)</h2>
              <button
                @click="addRange('winRate')"
                class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
              >
                Add Range
              </button>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">Name (for analytics table, optional):</label>
              <input
                v-model="editSettings.winRate.name"
                type="text"
                placeholder="Enter name..."
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div class="space-y-2">
              <div
                v-for="(range, index) in editSettings.winRate.ranges"
                :key="index"
                class="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg"
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
              <p v-if="editSettings.winRate.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
                No ranges configured. Click "Add Range" to add one.
              </p>
            </div>
          </div>

          <!-- Avg ATH MCap -->
          <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Average ATH Market Cap (Percentile)</h2>
              <button
                @click="addRange('avgAthMcap')"
                class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
              >
                Add Range
              </button>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">Name (for analytics table, optional):</label>
              <input
                v-model="editSettings.avgAthMcap.name"
                type="text"
                placeholder="Enter name..."
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div class="space-y-2">
              <div
                v-for="(range, index) in editSettings.avgAthMcap.ranges"
                :key="index"
                class="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg"
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
              <p v-if="editSettings.avgAthMcap.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
                No ranges configured. Click "Add Range" to add one.
              </p>
            </div>
          </div>

          <!-- Median ATH MCap -->
          <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Median ATH Market Cap (Percentile)</h2>
              <button
                @click="addRange('medianAthMcap')"
                class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
              >
                Add Range
              </button>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">Name (for analytics table, optional):</label>
              <input
                v-model="editSettings.medianAthMcap.name"
                type="text"
                placeholder="Enter name..."
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div class="space-y-2">
              <div
                v-for="(range, index) in editSettings.medianAthMcap.ranges"
                :key="index"
                class="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg"
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
              <p v-if="editSettings.medianAthMcap.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
                No ranges configured. Click "Add Range" to add one.
              </p>
            </div>
          </div>

          <!-- Avg Rug Rate -->
          <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Average Rug Rate (%)</h2>
              <button
                @click="addRange('avgRugRate')"
                class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
              >
                Add Range
              </button>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">Name (for analytics table, optional):</label>
              <input
                v-model="editSettings.avgRugRate.name"
                type="text"
                placeholder="Enter name..."
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div class="space-y-2">
              <div
                v-for="(range, index) in editSettings.avgRugRate.ranges"
                :key="index"
                class="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg"
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
              <p v-if="editSettings.avgRugRate.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
                No ranges configured. Click "Add Range" to add one.
              </p>
            </div>
          </div>

          <!-- Avg Rug Rate by Time Bucket -->
          <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-100">Average Rug Rate by Time Bucket (seconds)</h2>
              <button
                @click="addTimeBucketRange"
                class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
              >
                Add Range
              </button>
            </div>
            <div class="mb-4">
              <label class="block text-sm text-gray-300 mb-2">Name (for analytics table, optional):</label>
              <input
                v-model="editSettings.avgRugRateByTimeBucket.name"
                type="text"
                placeholder="Enter name..."
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div class="space-y-2">
              <div
                v-for="(range, index) in editSettings.avgRugRateByTimeBucket.ranges"
                :key="index"
                class="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg"
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
              <p v-if="editSettings.avgRugRateByTimeBucket.ranges.length === 0" class="text-sm text-gray-500 text-center py-4">
                No ranges configured. Click "Add Range" to add one.
              </p>
            </div>
          </div>
        </div>

        <!-- Multiplier Configs (2 columns) -->
        <div class="mb-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-100">% of Tokens That At Least "X"x From Starting MCAP</h2>
            <button
              @click="addMultiplierConfig"
              class="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Add Multiplier
            </button>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              v-for="(config, configIndex) in editSettings.multiplierConfigs"
              :key="configIndex"
              class="p-4 bg-gray-900/50 rounded-lg border border-gray-700"
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
              <div class="mb-3">
                <label class="block text-sm text-gray-300 mb-2">Name (for analytics table, optional):</label>
                <input
                  v-model="config.name"
                  type="text"
                  placeholder="Enter name..."
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
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
                  class="flex items-center gap-2 p-2 bg-gray-800/50 rounded"
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
            <p v-if="editSettings.multiplierConfigs.length === 0" class="text-sm text-gray-500 text-center py-4">
              No multiplier configurations. Click "Add Multiplier" to add one.
            </p>
          </div>
        </div>

        <!-- Dialog Actions -->
        <div class="flex gap-3 pt-4 border-t border-gray-700">
          <button
            @click="cancelEdit"
            class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            @click="saveEdit"
            class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Save Preset Dialog -->
    <div
      v-if="showSaveDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="handleCancelSaveDialog"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Save Preset</h3>
          <button
            @click="handleCancelSaveDialog"
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
              @click="handleCancelSaveDialog"
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
import { ref, computed, onMounted, watch } from 'vue'
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
const previousSelectedPresetId = ref<number | ''>('') // Store previous value when creating new preset
const appliedPresetId = ref<number | null>(null)
const showSaveDialog = ref(false)
const showDeleteDialog = ref(false)
const showEditDialog = ref(false)
const presetName = ref('')
const saveAsDefault = ref(false)
const saving = ref(false)
const deleting = ref(false)
const applying = ref(false)

// Helper to get default empty settings
const getDefaultSettings = (): ScoringSettings => ({
  trackingTimeSeconds: 15,
  winRate: { ranges: [] },
  avgAthMcap: { ranges: [] },
  medianAthMcap: { ranges: [] },
  multiplierConfigs: [],
  avgRugRate: { ranges: [] },
  avgRugRateByTimeBucket: { ranges: [] }
})

// Helper function to normalize settings (convert old format to new format if needed)
const normalizeSettings = (settings: any): ScoringSettings => {
  const normalized: ScoringSettings = {
    trackingTimeSeconds: settings.trackingTimeSeconds || 15,
    winRate: Array.isArray(settings.winRate) 
      ? { ranges: settings.winRate } 
      : (settings.winRate && typeof settings.winRate === 'object' && 'ranges' in settings.winRate
          ? settings.winRate
          : { ranges: [] }),
    avgAthMcap: Array.isArray(settings.avgAthMcap)
      ? { ranges: settings.avgAthMcap }
      : (settings.avgAthMcap && typeof settings.avgAthMcap === 'object' && 'ranges' in settings.avgAthMcap
          ? settings.avgAthMcap
          : { ranges: [] }),
    medianAthMcap: Array.isArray(settings.medianAthMcap)
      ? { ranges: settings.medianAthMcap }
      : (settings.medianAthMcap && typeof settings.medianAthMcap === 'object' && 'ranges' in settings.medianAthMcap
          ? settings.medianAthMcap
          : { ranges: [] }),
    multiplierConfigs: Array.isArray(settings.multiplierConfigs) ? settings.multiplierConfigs : [],
    avgRugRate: Array.isArray(settings.avgRugRate)
      ? { ranges: settings.avgRugRate }
      : (settings.avgRugRate && typeof settings.avgRugRate === 'object' && 'ranges' in settings.avgRugRate
          ? settings.avgRugRate
          : { ranges: [] }),
    avgRugRateByTimeBucket: Array.isArray(settings.avgRugRateByTimeBucket)
      ? { ranges: settings.avgRugRateByTimeBucket }
      : (settings.avgRugRateByTimeBucket && typeof settings.avgRugRateByTimeBucket === 'object' && 'ranges' in settings.avgRugRateByTimeBucket
          ? settings.avgRugRateByTimeBucket
          : { ranges: [] })
  }
  return normalized
}

const settings = ref<ScoringSettings>(getDefaultSettings())

const editSettings = ref<ScoringSettings>(getDefaultSettings())

const displaySettings = computed(() => {
  if (selectedPresetId.value || appliedPresetId.value) {
    return normalizeSettings(settings.value)
  }
  return getDefaultSettings()
})

const isSelectedPresetDefault = computed(() => {
  if (!selectedPresetId.value) return false
  const preset = presets.value.find(p => p.id === selectedPresetId.value)
  return preset?.isDefault || false
})

const addRange = (type: 'winRate' | 'avgAthMcap' | 'medianAthMcap' | 'avgRugRate') => {
  if (!editSettings.value[type].ranges) {
    editSettings.value[type].ranges = []
  }
  editSettings.value[type].ranges.push({ min: 0, max: 100, score: 0 })
}

const removeRange = (type: 'winRate' | 'avgAthMcap' | 'medianAthMcap' | 'avgRugRate', index: number) => {
  if (editSettings.value[type].ranges) {
    editSettings.value[type].ranges.splice(index, 1)
  }
}

const addMultiplierConfig = () => {
  editSettings.value.multiplierConfigs.push({
    multiplier: 1.5,
    ranges: []
  })
}

const removeMultiplierConfig = (index: number) => {
  editSettings.value.multiplierConfigs.splice(index, 1)
}

const addRangeToMultiplier = (configIndex: number) => {
  editSettings.value.multiplierConfigs[configIndex].ranges.push({ min: 0, max: 100, score: 0 })
}

const removeRangeFromMultiplier = (configIndex: number, rangeIndex: number) => {
  editSettings.value.multiplierConfigs[configIndex].ranges.splice(rangeIndex, 1)
}

const addTimeBucketRange = () => {
  if (!editSettings.value.avgRugRateByTimeBucket.ranges) {
    editSettings.value.avgRugRateByTimeBucket.ranges = []
  }
  editSettings.value.avgRugRateByTimeBucket.ranges.push({ min: 0, max: 120, score: 0 })
}

const removeTimeBucketRange = (index: number) => {
  if (editSettings.value.avgRugRateByTimeBucket.ranges) {
    editSettings.value.avgRugRateByTimeBucket.ranges.splice(index, 1)
  }
}

const loadPreset = async () => {
  if (!selectedPresetId.value) {
    settings.value = getDefaultSettings()
    return
  }

  try {
    const preset = await getScoringPreset(selectedPresetId.value as number)
    settings.value = normalizeSettings(preset.settings)
    presetName.value = preset.name
    saveAsDefault.value = preset.isDefault
  } catch (error: any) {
    alert(error.message || 'Failed to load preset')
  }
}

const handleNewPreset = () => {
  // Store the current selectedPresetId so we can restore it if user cancels
  previousSelectedPresetId.value = selectedPresetId.value
  // Open edit dialog with default/empty settings for the new preset
  editSettings.value = getDefaultSettings()
  showEditDialog.value = true
}

const handleSavePreset = async () => {
  if (!presetName.value.trim()) {
    alert('Please enter a preset name')
    return
  }

  if (settings.value.trackingTimeSeconds < 15 || settings.value.trackingTimeSeconds > 120) {
    alert('Tracking time must be between 15 and 120 seconds')
    return
  }

  saving.value = true
  try {
    if (selectedPresetId.value && !isSelectedPresetDefault.value) {
      // Update existing preset
      await updateScoringPreset(selectedPresetId.value as number, {
        name: presetName.value,
        settings: settings.value,
        isDefault: saveAsDefault.value
      })
      await loadPresets()
      await loadPreset()
    } else {
      // Create new preset - use editSettings (from dialog)
      const settingsToSave = editSettings.value
      const newPreset = await createScoringPreset(presetName.value, settingsToSave, saveAsDefault.value)
      await loadPresets()
      selectedPresetId.value = newPreset.id
      // Clear the previous selectedPresetId since we successfully created a new preset
      previousSelectedPresetId.value = ''
      // Update display settings to show the newly saved preset
      settings.value = JSON.parse(JSON.stringify(settingsToSave))
    }
    
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
    settings.value = getDefaultSettings()
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
    if (applied.settings) {
      settings.value = normalizeSettings(applied.settings)
      if (applied.presetId) {
        selectedPresetId.value = applied.presetId
      }
    }
  } catch (error: any) {
    console.error('Error loading applied settings:', error)
    try {
      const defaultPresetItem = presets.value.find(p => p.isDefault)
      if (defaultPresetItem) {
        selectedPresetId.value = defaultPresetItem.id
        await loadPreset()
        await handleApplySettings()
      }
    } catch (err: any) {
      console.error('Error loading default preset:', err)
    }
  }
}

const handleApplySettings = async () => {
  // Validate settings
  const validationError = validateSettings(settings.value)
  if (validationError) {
    alert(validationError)
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

const cancelEdit = () => {
  editSettings.value = JSON.parse(JSON.stringify(settings.value))
  // If this was a new preset (selectedPresetId is empty), restore the previous selection
  if (!selectedPresetId.value && previousSelectedPresetId.value) {
    selectedPresetId.value = previousSelectedPresetId.value
    previousSelectedPresetId.value = ''
  }
  showEditDialog.value = false
}

// Handle closing save dialog (cancel)
const handleCancelSaveDialog = () => {
  // If this was a new preset (selectedPresetId is empty), restore the previous selection
  if (!selectedPresetId.value && previousSelectedPresetId.value) {
    selectedPresetId.value = previousSelectedPresetId.value
    previousSelectedPresetId.value = ''
  }
  showSaveDialog.value = false
}

// Helper function to check if two ranges overlap
const rangesOverlap = (range1: { min: number; max: number }, range2: { min: number; max: number }): boolean => {
  // Two ranges [a, b] and [c, d] overlap if max(a, c) < min(b, d)
  return Math.max(range1.min, range2.min) < Math.min(range1.max, range2.max)
}

// Helper function to check for overlapping ranges in an array
const checkRangeOverlaps = (ranges: { min: number; max: number }[], metricName: string): string | null => {
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        return `${metricName} ranges overlap: ${ranges[i].min}-${ranges[i].max} and ${ranges[j].min}-${ranges[j].max} are overlapping`
      }
    }
  }
  return null
}

// Validate settings (reusable function)
const validateSettings = (settingsToValidate: ScoringSettings): string | null => {
  // Validate tracking time
  if (settingsToValidate.trackingTimeSeconds < 15 || settingsToValidate.trackingTimeSeconds > 120) {
    return 'Tracking time must be between 15 and 120 seconds'
  }

  // Check if at least one data metric has scoring logic (ranges)
  const hasWinRateRanges = settingsToValidate.winRate.ranges && settingsToValidate.winRate.ranges.length > 0
  const hasAvgAthMcapRanges = settingsToValidate.avgAthMcap.ranges && settingsToValidate.avgAthMcap.ranges.length > 0
  const hasMedianAthMcapRanges = settingsToValidate.medianAthMcap.ranges && settingsToValidate.medianAthMcap.ranges.length > 0
  const hasAvgRugRateRanges = settingsToValidate.avgRugRate.ranges && settingsToValidate.avgRugRate.ranges.length > 0
  const hasAvgRugRateByTimeBucketRanges = settingsToValidate.avgRugRateByTimeBucket.ranges && settingsToValidate.avgRugRateByTimeBucket.ranges.length > 0
  const hasMultiplierConfigs = settingsToValidate.multiplierConfigs && settingsToValidate.multiplierConfigs.length > 0 && 
    settingsToValidate.multiplierConfigs.some((config: any) => config.ranges && config.ranges.length > 0)

  const hasAnyScoringLogic = hasWinRateRanges || 
    hasAvgAthMcapRanges || 
    hasMedianAthMcapRanges || 
    hasAvgRugRateRanges || 
    hasAvgRugRateByTimeBucketRanges || 
    hasMultiplierConfigs

  if (!hasAnyScoringLogic) {
    return 'At least one data metric scoring logic must be configured (ranges must be added to at least one metric)'
  }

  // Check for overlapping ranges in each metric
  if (settingsToValidate.winRate.ranges && settingsToValidate.winRate.ranges.length > 0) {
    const overlapError = checkRangeOverlaps(settingsToValidate.winRate.ranges, 'Win Rate')
    if (overlapError) return overlapError
  }

  if (settingsToValidate.avgAthMcap.ranges && settingsToValidate.avgAthMcap.ranges.length > 0) {
    const overlapError = checkRangeOverlaps(settingsToValidate.avgAthMcap.ranges, 'Avg ATH MCap')
    if (overlapError) return overlapError
  }

  if (settingsToValidate.medianAthMcap.ranges && settingsToValidate.medianAthMcap.ranges.length > 0) {
    const overlapError = checkRangeOverlaps(settingsToValidate.medianAthMcap.ranges, 'Median ATH MCap')
    if (overlapError) return overlapError
  }

  if (settingsToValidate.avgRugRate.ranges && settingsToValidate.avgRugRate.ranges.length > 0) {
    const overlapError = checkRangeOverlaps(settingsToValidate.avgRugRate.ranges, 'Avg Rug Rate')
    if (overlapError) return overlapError
  }

  if (settingsToValidate.avgRugRateByTimeBucket.ranges && settingsToValidate.avgRugRateByTimeBucket.ranges.length > 0) {
    const overlapError = checkRangeOverlaps(settingsToValidate.avgRugRateByTimeBucket.ranges, 'Avg Rug Rate by Time Bucket')
    if (overlapError) return overlapError
  }

  // Check multiplier configs
  if (settingsToValidate.multiplierConfigs && settingsToValidate.multiplierConfigs.length > 0) {
    for (const config of settingsToValidate.multiplierConfigs) {
      if (config.ranges && config.ranges.length > 0) {
        const overlapError = checkRangeOverlaps(config.ranges, `Multiplier ${config.multiplier}x`)
        if (overlapError) return overlapError
      }
    }
  }

  return null
}

const saveEdit = () => {
  // Validate settings before saving
  const validationError = validateSettings(editSettings.value)
  if (validationError) {
    alert(validationError)
    return
  }

  // If it's an existing preset, update the display immediately
  if (selectedPresetId.value) {
    settings.value = JSON.parse(JSON.stringify(editSettings.value))
    showEditDialog.value = false
  } else {
    // If it's a new preset, don't update display yet - just close dialog and open save dialog
    // The display will be updated after the preset is saved
    showEditDialog.value = false
    presetName.value = ''
    saveAsDefault.value = false
    showSaveDialog.value = true
  }
}

// Watch for edit dialog opening
watch(showEditDialog, (isOpen) => {
  if (isOpen) {
    // Prevent opening edit dialog for default preset
    if (isSelectedPresetDefault.value) {
      showEditDialog.value = false
      alert('Cannot edit the default preset. Please create a new preset or set another preset as default first.')
      return
    }
    // Only copy settings if editing an existing preset (not a new preset)
    // For new presets, editSettings is already initialized with defaults in handleNewPreset()
    if (selectedPresetId.value) {
      editSettings.value = JSON.parse(JSON.stringify(settings.value))
    }
    // If selectedPresetId is empty, it's a new preset and editSettings already has defaults
  }
})

onMounted(async () => {
  await loadPresets()
  await loadAppliedSettings()
})
</script>
