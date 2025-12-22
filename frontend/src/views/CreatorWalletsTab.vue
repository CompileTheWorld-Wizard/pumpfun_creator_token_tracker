<template>
  <div class="w-full">
    <!-- Filter Section Header -->
    <div class="mb-3 flex items-center gap-3 flex-wrap">
      <button
        @click="filtersExpanded = !filtersExpanded"
        class="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg transition flex items-center gap-2"
      >
        <svg 
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': filtersExpanded }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <span>Filters</span>
        <span v-if="hasActiveFilters" class="ml-1 px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px]">
          {{ activeFilterCount }}
        </span>
      </button>
      <button
        @click="whatIfExpanded = !whatIfExpanded"
        class="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg transition flex items-center gap-2"
      >
        <svg 
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': whatIfExpanded }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        <span>What If</span>
      </button>
      <label class="text-xs text-gray-400 font-medium">Items per page:</label>
      <select
        v-model="itemsPerPage"
        @change="handleItemsPerPageChange"
        class="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
      >
        <option :value="10">10</option>
        <option :value="20">20</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option value="all">All</option>
      </select>
      <div class="flex items-center gap-2 ml-auto">
        <label class="text-xs text-gray-400 font-medium">View:</label>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400" :class="{ 'text-gray-600': viewMode === 'score' }">Data</span>
          <button
            @click="toggleViewMode"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
              viewMode === 'score' ? 'bg-purple-600' : 'bg-gray-600'
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                viewMode === 'score' ? 'translate-x-6' : 'translate-x-1'
              ]"
            ></span>
          </button>
          <span class="text-xs text-gray-400" :class="{ 'text-gray-600': viewMode === 'data' }">Score</span>
        </div>
      </div>
      <button
        @click="handleExport"
        :disabled="loading || wallets.length === 0"
        class="px-3 py-1 text-xs bg-green-600/90 hover:bg-green-600 text-white font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg 
          class="w-4 h-4"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <span>Export</span>
      </button>
      <button
        @click="handleRefresh"
        :disabled="refreshing"
        class="px-3 py-1 text-xs bg-purple-600/90 hover:bg-purple-600 text-white font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg 
          :class="['w-4 h-4', refreshing ? 'animate-spin' : '']"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>{{ refreshing ? 'Refreshing...' : 'Refresh' }}</span>
      </button>
    </div>

    <!-- Filters Panel (Collapsible) -->
    <div v-if="filtersExpanded" class="mb-3 bg-gray-900/80 border border-gray-800 rounded-lg p-4">
      <div class="space-y-4">
        <!-- Filter Presets -->
        <div class="flex items-center gap-2 pb-3 border-b border-gray-700">
          <label class="text-xs text-gray-400 font-medium">Filter Preset:</label>
          <select
            v-model="selectedFilterPreset"
            @change="loadFilterPreset"
            class="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">-- Select Preset --</option>
            <option v-for="preset in filterPresets" :key="preset.id" :value="preset.id">
              {{ preset.name }}
            </option>
          </select>
          <button
            @click="showSavePresetDialog = true"
            class="px-2 py-1 text-xs bg-blue-600/90 hover:bg-blue-600 text-white font-semibold rounded transition"
          >
            Save Preset
          </button>
          <button
            v-if="selectedFilterPreset"
            @click="removeFilterPreset"
            class="px-2 py-1 text-xs bg-red-600/90 hover:bg-red-600 text-white font-semibold rounded transition"
          >
            Remove Preset
          </button>
          <button
            @click="clearFilters"
            class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded transition"
          >
            Clear All
          </button>
        </div>

        <!-- Active Filters Widgets -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <label class="text-xs font-semibold text-gray-300">Active Filters:</label>
            <button
              @click="showAddFilterDialog = true"
              class="px-3 py-1.5 text-xs bg-purple-600/90 hover:bg-purple-600 text-white font-semibold rounded-lg transition flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Add Filter
            </button>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <!-- Total Tokens Filter Widget -->
            <div v-if="isFilterAdded('totalTokens')" class="inline-flex items-center gap-2 px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg">
              <span class="text-xs font-semibold text-purple-300">Total Tokens:</span>
              <input
                v-model.number="filters.totalTokens.min"
                type="number"
                min="1"
                max="150"
                placeholder="Min"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filters.totalTokens.max"
                type="number"
                min="1"
                max="150"
                placeholder="Max"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 w-20"
              />
              <button
                @click="removeFilter('totalTokens')"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Bonded Tokens Filter Widget -->
            <div v-if="isFilterAdded('bondedTokens')" class="inline-flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <span class="text-xs font-semibold text-blue-300">Bonded Tokens:</span>
              <input
                v-model.number="filters.bondedTokens.min"
                type="number"
                min="0"
                max="150"
                placeholder="Min"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filters.bondedTokens.max"
                type="number"
                min="0"
                max="150"
                placeholder="Max"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-20"
              />
              <button
                @click="removeFilter('bondedTokens')"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Win Rate Filter Widgets -->
            <div
              v-for="(filter, index) in filters.winRate"
              :key="index"
              class="inline-flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-500/30 rounded-lg"
            >
              <span class="text-xs font-semibold text-green-300">Win Rate ({{ filter.type === 'percent' ? '%' : 'Score' }}):</span>
              <input
                v-model.number="filter.min"
                type="number"
                :min="filter.type === 'percent' ? '0' : undefined"
                :max="filter.type === 'percent' ? '100' : undefined"
                :step="filter.type === 'percent' ? '0.1' : '0.1'"
                :placeholder="filter.type === 'percent' ? 'Min %' : 'Min Score'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filter.max"
                type="number"
                :min="filter.type === 'percent' ? '0' : undefined"
                :max="filter.type === 'percent' ? '100' : undefined"
                :step="filter.type === 'percent' ? '0.1' : '0.1'"
                :placeholder="filter.type === 'percent' ? 'Max %' : 'Max Score'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
              />
              <button
                @click="removeWinRateFilter(index)"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Average Market Cap Filter Widgets -->
            <div
              v-for="(filter, index) in filters.avgMcap"
              :key="index"
              class="inline-flex items-center gap-2 px-3 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded-lg"
            >
              <span class="text-xs font-semibold text-cyan-300">
                Avg MCap ({{ filter.type === 'mcap' ? 'Amount' : filter.type === 'percentile' ? 'Percentile' : 'Score' }}):
              </span>
              <input
                v-model.number="filter.min"
                type="number"
                :step="filter.type === 'mcap' ? '100' : '0.1'"
                :min="filter.type === 'percentile' ? '0' : undefined"
                :max="filter.type === 'percentile' ? '100' : undefined"
                :placeholder="filter.type === 'mcap' ? 'Min $' : 'Min'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filter.max"
                type="number"
                :step="filter.type === 'mcap' ? '100' : '0.1'"
                :min="filter.type === 'percentile' ? '0' : undefined"
                :max="filter.type === 'percentile' ? '100' : undefined"
                :placeholder="filter.type === 'mcap' ? 'Max $' : 'Max'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-20"
              />
              <button
                @click="removeAvgMcapFilter(index)"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Median ATH Market Cap Filter Widgets -->
            <div
              v-for="(filter, index) in filters.medianMcap"
              :key="index"
              class="inline-flex items-center gap-2 px-3 py-2 bg-orange-600/20 border border-orange-500/30 rounded-lg"
            >
              <span class="text-xs font-semibold text-orange-300">
                Median MCap ({{ filter.type === 'mcap' ? 'Amount' : 'Score' }}):
              </span>
              <input
                v-model.number="filter.min"
                type="number"
                :step="filter.type === 'mcap' ? '100' : '0.1'"
                :placeholder="filter.type === 'mcap' ? 'Min $' : 'Min Score'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filter.max"
                type="number"
                :step="filter.type === 'mcap' ? '100' : '0.1'"
                :placeholder="filter.type === 'mcap' ? 'Max $' : 'Max Score'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 w-20"
              />
              <button
                @click="removeMedianMcapFilter(index)"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Avg Buy/Sells Filter Widgets -->
            <div
              v-for="(filter, index) in filters.avgBuySells"
              :key="index"
              class="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg"
            >
              <span class="text-xs font-semibold text-indigo-300">
                {{ getAvgBuySellsFilterLabel(filter.type) }}:
              </span>
              <input
                v-model.number="filter.min"
                type="number"
                :step="filter.type === 'buySol' || filter.type === 'sellSol' ? '0.01' : '1'"
                placeholder="Min"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filter.max"
                type="number"
                :step="filter.type === 'buySol' || filter.type === 'sellSol' ? '0.01' : '1'"
                placeholder="Max"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
              />
              <button
                @click="removeAvgBuySellsFilter(index)"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Expected ROI Filter Widgets -->
            <div
              v-for="(filter, index) in filters.expectedROI"
              :key="index"
              class="inline-flex items-center gap-2 px-3 py-2 bg-pink-600/20 border border-pink-500/30 rounded-lg"
            >
              <span class="text-xs font-semibold text-pink-300">
                Expected ROI ({{ filter.type === '1st' ? '1st' : filter.type === '2nd' ? '2nd' : '3rd' }}):
              </span>
              <input
                v-model.number="filter.min"
                type="number"
                step="0.1"
                placeholder="Min %"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-pink-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filter.max"
                type="number"
                step="0.1"
                placeholder="Max %"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-pink-500 w-20"
              />
              <button
                @click="removeExpectedROIFilter(index)"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Rug Rate Filter Widget -->
            <div v-if="addedFilterTypes.has('rugRate')" class="inline-flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-500/30 rounded-lg">
              <span class="text-xs font-semibold text-red-300">Rug Rate (%):</span>
              <input
                v-model.number="filters.rugRate.min"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Min %"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filters.rugRate.max"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Max %"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-500 w-20"
              />
              <button
                @click="removeFilter('rugRate')"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Avg Rug Time Filter Widget -->
            <div v-if="addedFilterTypes.has('avgRugTime')" class="inline-flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-500/30 rounded-lg">
              <span class="text-xs font-semibold text-red-300">Avg Rug Time (seconds):</span>
              <input
                v-model.number="filters.avgRugTime.min"
                type="number"
                min="0"
                step="1"
                placeholder="Min"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filters.avgRugTime.max"
                type="number"
                min="0"
                step="1"
                placeholder="Max"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-500 w-20"
              />
              <button
                @click="removeFilter('avgRugTime')"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Final Score Filter Widget -->
            <div v-if="addedFilterTypes.has('finalScore')" class="inline-flex items-center gap-2 px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-lg">
              <span class="text-xs font-semibold text-violet-300">Final Score:</span>
              <input
                v-model.number="filters.finalScore.min"
                type="number"
                step="0.1"
                placeholder="Min"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filters.finalScore.max"
                type="number"
                step="0.1"
                placeholder="Max"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 w-20"
              />
              <button
                @click="removeFilter('finalScore')"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Multiplier Scores Filter Widgets -->
            <div
              v-for="(filter, index) in filters.multiplierScores"
              :key="index"
              class="inline-flex items-center gap-2 px-3 py-2 bg-yellow-600/20 border border-yellow-500/30 rounded-lg"
            >
              <span class="text-xs font-semibold text-yellow-300">
                Multiplier {{ filter.multiplier }}x ({{ filter.type === 'percent' ? '%' : 'Score' }}):
              </span>
              <input
                v-model.number="filter.min"
                type="number"
                :min="filter.type === 'percent' ? '0' : undefined"
                :max="filter.type === 'percent' ? '100' : undefined"
                :step="filter.type === 'percent' ? '0.1' : '0.1'"
                :placeholder="filter.type === 'percent' ? 'Min %' : 'Min Score'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-yellow-500 w-20"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                v-model.number="filter.max"
                type="number"
                :min="filter.type === 'percent' ? '0' : undefined"
                :max="filter.type === 'percent' ? '100' : undefined"
                :step="filter.type === 'percent' ? '0.1' : '0.1'"
                :placeholder="filter.type === 'percent' ? 'Max %' : 'Max Score'"
                class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-yellow-500 w-20"
              />
              <button
                @click="removeMultiplierFilter(index)"
                class="ml-1 text-gray-400 hover:text-red-400 transition"
                title="Remove filter"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <p v-if="!hasActiveFilters" class="text-xs text-gray-500 py-2">
              No filters active. Click "Add Filter" to add filters.
            </p>
          </div>
        </div>

        <!-- Apply Filters Button -->
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-700">
          <button
            @click="applyFilters"
            class="px-4 py-2 text-xs bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Add Filter Dialog -->
    <div
      v-if="showAddFilterDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showAddFilterDialog = false"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Add Filter</h3>
          <button
            @click="showAddFilterDialog = false"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <!-- Search Box -->
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-2">Search Filter Type:</label>
            <div class="relative">
              <input
                v-model="filterSearchQuery"
                type="text"
                placeholder="Search filters..."
                class="w-full px-3 py-2.5 pl-10 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
              />
              <svg 
                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <button
                v-if="filterSearchQuery"
                @click="filterSearchQuery = ''"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Filter Type Selection (Tree) -->
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-2">Select Filter Type:</label>
            <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
              <!-- Token Count Group -->
              <div v-if="shouldShowFilterItem('Total Tokens', 'Token Count') || shouldShowFilterItem('Bonded Tokens', 'Token Count')" class="mb-2">
                <div 
                  @click="expandedGroups.tokenCount = !expandedGroups.tokenCount"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.tokenCount || (filterSearchQuery && (shouldShowFilterItem('Total Tokens', 'Token Count') || shouldShowFilterItem('Bonded Tokens', 'Token Count'))) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Token Count
                </div>
                <div v-if="expandedGroups.tokenCount || (filterSearchQuery && (shouldShowFilterItem('Total Tokens', 'Token Count') || shouldShowFilterItem('Bonded Tokens', 'Token Count')))" class="ml-4 space-y-1">
                  <div
                    v-if="shouldShowFilterItem('Total Tokens', 'Token Count')"
                    @click="!isFilterAdded('totalTokens') && selectFilterType('totalTokens')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isFilterAdded('totalTokens')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'totalTokens' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Total Tokens
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Bonded Tokens', 'Token Count')"
                    @click="!isFilterAdded('bondedTokens') && selectFilterType('bondedTokens')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isFilterAdded('bondedTokens')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'bondedTokens' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Bonded Tokens
                  </div>
                </div>
              </div>

              <!-- Win Rate Group -->
              <div v-if="shouldShowFilterItem('Win Rate (Percentage)', 'Win Rate') || shouldShowFilterItem('Win Rate (Score)', 'Win Rate')" class="mb-2">
                <div 
                  @click="expandedGroups.winRate = !expandedGroups.winRate"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.winRate || (filterSearchQuery && (shouldShowFilterItem('Win Rate (Percentage)', 'Win Rate') || shouldShowFilterItem('Win Rate (Score)', 'Win Rate'))) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Win Rate
                </div>
                <div v-if="expandedGroups.winRate || (filterSearchQuery && (shouldShowFilterItem('Win Rate (Percentage)', 'Win Rate') || shouldShowFilterItem('Win Rate (Score)', 'Win Rate')))" class="ml-4 space-y-1">
                  <div
                    v-if="shouldShowFilterItem('Win Rate (Percentage)', 'Win Rate')"
                    @click="!isWinRateFilterAdded('percent') && selectFilterType('winRatePercent')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isWinRateFilterAdded('percent')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'winRatePercent' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Win Rate (Percentage)
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Win Rate (Score)', 'Win Rate')"
                    @click="!isWinRateFilterAdded('score') && selectFilterType('winRateScore')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isWinRateFilterAdded('score')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'winRateScore' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Win Rate (Score)
                  </div>
                </div>
              </div>

              <!-- Average Market Cap Group -->
              <div v-if="shouldShowFilterItem('Average MCap (Amount)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Percentile)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Score)', 'Average Market Cap')" class="mb-2">
                <div 
                  @click="expandedGroups.avgMcap = !expandedGroups.avgMcap"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.avgMcap || (filterSearchQuery && (shouldShowFilterItem('Average MCap (Amount)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Percentile)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Score)', 'Average Market Cap'))) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Average Market Cap
                </div>
                <div v-if="expandedGroups.avgMcap || (filterSearchQuery && (shouldShowFilterItem('Average MCap (Amount)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Percentile)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Score)', 'Average Market Cap')))" class="ml-4 space-y-1">
                  <div
                    v-if="shouldShowFilterItem('Average MCap (Amount)', 'Average Market Cap')"
                    @click="!isAvgMcapFilterAdded('mcap') && selectFilterType('avgMcapAmount')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgMcapFilterAdded('mcap')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgMcapAmount' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Average MCap (Amount)
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Average MCap (Percentile)', 'Average Market Cap')"
                    @click="!isAvgMcapFilterAdded('percentile') && selectFilterType('avgMcapPercentile')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgMcapFilterAdded('percentile')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgMcapPercentile' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Average MCap (Percentile)
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Average MCap (Score)', 'Average Market Cap')"
                    @click="!isAvgMcapFilterAdded('score') && selectFilterType('avgMcapScore')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgMcapFilterAdded('score')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgMcapScore' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Average MCap (Score)
                  </div>
                </div>
              </div>

              <!-- Median ATH Market Cap Group -->
              <div v-if="shouldShowFilterItem('Median MCap (Amount)', 'Median ATH Market Cap') || shouldShowFilterItem('Median MCap (Score)', 'Median ATH Market Cap')">
                <div 
                  @click="expandedGroups.medianMcap = !expandedGroups.medianMcap"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.medianMcap || (filterSearchQuery && (shouldShowFilterItem('Median MCap (Amount)', 'Median ATH Market Cap') || shouldShowFilterItem('Median MCap (Score)', 'Median ATH Market Cap'))) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Median ATH Market Cap
                </div>
                <div v-if="expandedGroups.medianMcap || (filterSearchQuery && (shouldShowFilterItem('Median MCap (Amount)', 'Median ATH Market Cap') || shouldShowFilterItem('Median MCap (Score)', 'Median ATH Market Cap')))" class="ml-4 space-y-1">
                  <div
                    v-if="shouldShowFilterItem('Median MCap (Amount)', 'Median ATH Market Cap')"
                    @click="!isMedianMcapFilterAdded('mcap') && selectFilterType('medianMcapAmount')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isMedianMcapFilterAdded('mcap')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'medianMcapAmount' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Median MCap (Amount)
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Median MCap (Score)', 'Median ATH Market Cap')"
                    @click="!isMedianMcapFilterAdded('score') && selectFilterType('medianMcapScore')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isMedianMcapFilterAdded('score')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'medianMcapScore' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Median MCap (Score)
                  </div>
                </div>
              </div>

              <!-- Avg Buy/Sells Group -->
              <div v-if="shouldShowFilterItem('Buy Count', 'Avg Buy/Sells') || shouldShowFilterItem('Buy SOLs', 'Avg Buy/Sells') || shouldShowFilterItem('Sell Count', 'Avg Buy/Sells') || shouldShowFilterItem('Sell SOLs', 'Avg Buy/Sells')" class="mb-2">
                <div 
                  @click="expandedGroups.avgBuySells = !expandedGroups.avgBuySells"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.avgBuySells || (filterSearchQuery && (shouldShowFilterItem('Buy Count', 'Avg Buy/Sells') || shouldShowFilterItem('Buy SOLs', 'Avg Buy/Sells') || shouldShowFilterItem('Sell Count', 'Avg Buy/Sells') || shouldShowFilterItem('Sell SOLs', 'Avg Buy/Sells'))) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Avg Buy/Sells
                </div>
                <div v-if="expandedGroups.avgBuySells || (filterSearchQuery && (shouldShowFilterItem('Buy Count', 'Avg Buy/Sells') || shouldShowFilterItem('Buy SOLs', 'Avg Buy/Sells') || shouldShowFilterItem('Sell Count', 'Avg Buy/Sells') || shouldShowFilterItem('Sell SOLs', 'Avg Buy/Sells')))" class="ml-4 space-y-1">
                  <div
                    v-if="shouldShowFilterItem('Buy Count', 'Avg Buy/Sells')"
                    @click="!isAvgBuySellsFilterAdded('buyCount') && selectFilterType('avgBuyCount')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgBuySellsFilterAdded('buyCount')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgBuyCount' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Buy Count
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Buy SOLs', 'Avg Buy/Sells')"
                    @click="!isAvgBuySellsFilterAdded('buySol') && selectFilterType('avgBuySol')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgBuySellsFilterAdded('buySol')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgBuySol' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Buy SOLs
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Sell Count', 'Avg Buy/Sells')"
                    @click="!isAvgBuySellsFilterAdded('sellCount') && selectFilterType('avgSellCount')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgBuySellsFilterAdded('sellCount')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgSellCount' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Sell Count
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Sell SOLs', 'Avg Buy/Sells')"
                    @click="!isAvgBuySellsFilterAdded('sellSol') && selectFilterType('avgSellSol')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isAvgBuySellsFilterAdded('sellSol')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'avgSellSol' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Sell SOLs
                  </div>
                </div>
              </div>

              <!-- Expected ROI Group -->
              <div v-if="shouldShowFilterItem('Expected ROI (1st)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (2nd)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (3rd)', 'Expected ROI')" class="mb-2">
                <div 
                  @click="expandedGroups.expectedROI = !expandedGroups.expectedROI"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.expectedROI || (filterSearchQuery && (shouldShowFilterItem('Expected ROI (1st)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (2nd)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (3rd)', 'Expected ROI'))) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Expected ROI
                </div>
                <div v-if="expandedGroups.expectedROI || (filterSearchQuery && (shouldShowFilterItem('Expected ROI (1st)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (2nd)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (3rd)', 'Expected ROI')))" class="ml-4 space-y-1">
                  <div
                    v-if="shouldShowFilterItem('Expected ROI (1st)', 'Expected ROI')"
                    @click="!isExpectedROIFilterAdded('1st') && selectFilterType('expectedROI1st')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isExpectedROIFilterAdded('1st')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'expectedROI1st' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Expected ROI (1st)
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Expected ROI (2nd)', 'Expected ROI')"
                    @click="!isExpectedROIFilterAdded('2nd') && selectFilterType('expectedROI2nd')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isExpectedROIFilterAdded('2nd')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'expectedROI2nd' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Expected ROI (2nd)
                  </div>
                  <div
                    v-if="shouldShowFilterItem('Expected ROI (3rd)', 'Expected ROI')"
                    @click="!isExpectedROIFilterAdded('3rd') && selectFilterType('expectedROI3rd')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded transition',
                      isExpectedROIFilterAdded('3rd')
                        ? 'text-gray-500 cursor-not-allowed opacity-50'
                        : newFilterType === 'expectedROI3rd' 
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                          : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                    ]"
                  >
                    Expected ROI (3rd)
                  </div>
                </div>
              </div>

              <!-- Rug Rate Group -->
              <div v-if="shouldShowFilterItem('Rug Rate', 'Rug Rate')" class="mb-2">
                <div
                  @click="!isFilterAdded('rugRate') && selectFilterType('rugRate')"
                  :class="[
                    'px-2 py-1.5 text-xs rounded transition',
                    isFilterAdded('rugRate')
                      ? 'text-gray-500 cursor-not-allowed opacity-50'
                      : newFilterType === 'rugRate' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                        : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                  ]"
                >
                  Rug Rate (%)
                </div>
              </div>

              <!-- Avg Rug Time Group -->
              <div v-if="shouldShowFilterItem('Avg Rug Time', 'Avg Rug Time')" class="mb-2">
                <div
                  @click="!isFilterAdded('avgRugTime') && selectFilterType('avgRugTime')"
                  :class="[
                    'px-2 py-1.5 text-xs rounded transition',
                    isFilterAdded('avgRugTime')
                      ? 'text-gray-500 cursor-not-allowed opacity-50'
                      : newFilterType === 'avgRugTime' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                        : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                  ]"
                >
                  Avg Rug Time (seconds)
                </div>
              </div>

              <!-- Final Score Group -->
              <div v-if="shouldShowFilterItem('Final Score', 'Final Score')" class="mb-2">
                <div
                  @click="!isFilterAdded('finalScore') && selectFilterType('finalScore')"
                  :class="[
                    'px-2 py-1.5 text-xs rounded transition',
                    isFilterAdded('finalScore')
                      ? 'text-gray-500 cursor-not-allowed opacity-50'
                      : newFilterType === 'finalScore' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                        : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                  ]"
                >
                  Final Score
                </div>
              </div>

              <!-- Multiplier Scores Group -->
              <div v-if="shouldShowMultiplierGroup()" class="mb-2">
                <div 
                  @click="expandedGroups.multiplierScores = !expandedGroups.multiplierScores"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.multiplierScores || (filterSearchQuery && shouldShowMultiplierGroup()) }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Multiplier Scores
                </div>
                <div v-if="expandedGroups.multiplierScores || (filterSearchQuery && shouldShowMultiplierGroup())" class="ml-4 space-y-1">
                  <template v-for="config in scoringSettings?.multiplierConfigs || []" :key="config.multiplier">
                    <div
                      v-if="shouldShowFilterItem(`Multiplier ${config.multiplier}x (Percentage)`, 'Multiplier Scores')"
                      @click="!isMultiplierFilterAdded(config.multiplier, 'percent') && selectFilterType(`multiplier${config.multiplier}Percent`)"
                      :class="[
                        'px-2 py-1.5 text-xs rounded transition',
                        isMultiplierFilterAdded(config.multiplier, 'percent')
                          ? 'text-gray-500 cursor-not-allowed opacity-50'
                          : newFilterType === `multiplier${config.multiplier}Percent` 
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                            : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                      ]"
                    >
                      Multiplier {{ config.multiplier }}x (Percentage)
                    </div>
                    <div
                      v-if="shouldShowFilterItem(`Multiplier ${config.multiplier}x (Score)`, 'Multiplier Scores')"
                      @click="!isMultiplierFilterAdded(config.multiplier, 'score') && selectFilterType(`multiplier${config.multiplier}Score`)"
                      :class="[
                        'px-2 py-1.5 text-xs rounded transition',
                        isMultiplierFilterAdded(config.multiplier, 'score')
                          ? 'text-gray-500 cursor-not-allowed opacity-50'
                          : newFilterType === `multiplier${config.multiplier}Score` 
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 cursor-pointer' 
                            : 'text-gray-300 hover:bg-gray-700/50 cursor-pointer'
                      ]"
                    >
                      Multiplier {{ config.multiplier }}x (Score)
                    </div>
                  </template>
                </div>
              </div>

              <!-- No results message -->
              <div v-if="filterSearchQuery && !hasVisibleFilterItems" class="text-center py-4 text-gray-400 text-xs">
                No data metric
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="cancelAddFilter"
              class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              @click="confirmAddFilter"
              :disabled="!newFilterType || isSelectedFilterAlreadyAdded"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Filter
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- What If Settings Panel (Collapsible) -->
    <div v-if="whatIfExpanded" class="mb-3 bg-gray-900/80 border border-gray-800 rounded-lg p-4">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-gray-300">What If Simulation Settings</label>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">Show Column:</span>
            <button
              @click="toggleWhatIfColumn"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                showWhatIfColumn ? 'bg-purple-600' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  showWhatIfColumn ? 'translate-x-6' : 'translate-x-1'
                ]"
              ></span>
            </button>
          </div>
        </div>

        <!-- Buy Position -->
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">
            Buy Position (after dev):
          </label>
          <input
            v-model.number="whatIfSettings.buyPosition"
            type="number"
            min="1"
            max="10"
            placeholder="e.g., 2 = 2nd buy after dev"
            class="w-full px-3 py-2 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <!-- Sell Strategy -->
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">
            Sell Strategy:
          </label>
          <select
            v-model="whatIfSettings.sellStrategy"
            class="w-full px-3 py-2 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="time">Sell at X seconds</option>
            <option value="pnl">Sell at PNL marker</option>
            <option value="multiple">Multiple sells</option>
          </select>
        </div>

        <!-- Sell at X seconds -->
        <div v-if="whatIfSettings.sellStrategy === 'time'">
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">
            Sell at (seconds):
          </label>
          <input
            v-model.number="whatIfSettings.sellAtSeconds"
            type="number"
            min="0"
            max="15"
            placeholder="e.g., 5"
            class="w-full px-3 py-2 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <!-- Sell at PNL marker -->
        <div v-if="whatIfSettings.sellStrategy === 'pnl'">
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">
            Sell if PNL >= (%):
          </label>
          <input
            v-model.number="whatIfSettings.sellAtPnlPercent"
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g., 50"
            class="w-full px-3 py-2 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <!-- Multiple sells -->
        <div v-if="whatIfSettings.sellStrategy === 'multiple'">
          <label class="block text-xs font-semibold text-gray-300 mb-1.5">
            Multiple Sells:
          </label>
          <div class="space-y-2">
            <div
              v-for="(sell, index) in whatIfSettings.multipleSells"
              :key="index"
              class="space-y-1"
            >
              <div class="flex items-end gap-2">
                <div class="w-24">
                  <label class="block text-[10px] text-gray-400 mb-0.5">Type</label>
                  <select
                    v-model="sell.type"
                    class="w-full px-2 py-1.5 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="time">Time</option>
                    <option value="pnl">PNL</option>
                  </select>
                </div>
                <div class="flex-1">
                  <label class="block text-[10px] text-gray-400 mb-0.5">
                    {{ sell.type === 'time' ? 'Seconds' : 'PNL %' }}
                  </label>
                  <input
                    v-model.number="sell.value"
                    type="number"
                    :min="sell.type === 'time' ? 0 : 0"
                    :max="sell.type === 'time' ? 15 : undefined"
                    :step="sell.type === 'time' ? 1 : 0.1"
                    :placeholder="sell.type === 'time' ? 'e.g., 3' : 'e.g., 100'"
                    class="w-full px-2 py-1.5 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div class="flex-1">
                  <label class="block text-[10px] text-gray-400 mb-0.5">Size %</label>
                  <input
                    v-model.number="sell.sizePercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g., 50"
                    class="w-full px-2 py-1.5 text-xs bg-gray-800/80 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    :class="getMultipleSellValidationClass()"
                  />
                </div>
                <button
                  @click="removeMultipleSell(index)"
                  class="px-2 py-1.5 text-xs bg-red-600/90 hover:bg-red-600 text-white rounded transition"
                  style="height: 2rem; line-height: 1.5rem;"
                >
                  Remove
                </button>
              </div>
            </div>
            <div v-if="whatIfSettings.multipleSells && whatIfSettings.multipleSells.length > 0" class="text-[10px] text-gray-400">
              Total: {{ getTotalMultipleSellPercent().toFixed(1) }}%
              <span v-if="getTotalMultipleSellPercent() > 100" class="text-red-400 ml-1">(Exceeds 100%)</span>
              <span v-else-if="getTotalMultipleSellPercent() < 100" class="text-yellow-400 ml-1">({{ (100 - getTotalMultipleSellPercent()).toFixed(1) }}% remaining)</span>
            </div>
            <button
              @click="addMultipleSell"
              class="w-full px-3 py-1.5 text-xs bg-blue-600/90 hover:bg-blue-600 text-white font-semibold rounded transition"
            >
              Add Sell
            </button>
          </div>
        </div>

        <!-- Apply Button -->
        <button
          @click="applyWhatIfSettings"
          class="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition"
        >
          Apply What If Settings
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-900/20 border border-red-500/30 rounded p-2 mb-3">
      <p class="text-red-400 text-xs">{{ error }}</p>
    </div>

    <!-- Creator Wallets Table -->
    <div class="bg-gray-900/80 border border-gray-800 rounded overflow-hidden flex flex-col">
      <div class="overflow-x-auto overflow-y-auto relative" style="max-height: calc(100vh - 350px);">
        <!-- Loading Overlay -->
        <div v-if="loading" class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-0" style="top: 0;">
          <div class="flex items-center gap-2 bg-gray-900/60 backdrop-blur-md px-4 py-3 rounded-lg border border-gray-700/50">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
            <span class="text-xs text-gray-200 font-medium">Loading creator wallets...</span>
          </div>
        </div>
        <table class="w-full text-xs relative border-collapse border border-gray-700">
          <thead class="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
            <!-- Top row with merged headers -->
            <tr>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Wallet Address</th>
              <th rowspan="2" class="px-1 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700 w-14">
                <div class="leading-tight">
                  <div>Total</div>
                  <div>Tokens</div>
                  <div>(Valid)</div>
                </div>
              </th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Bonded Tokens</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Win Rate (% Bonded)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg ATH MCap</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Median ATH MCap</th>
              <th colspan="4" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">ATH MCap Percentiles</th>
              <th colspan="4" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Buys/Sells</th>
              <th colspan="3" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Expected ROI (1st/2nd/3rd Buy)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Rug Rate (%)</th>
              <th rowspan="2" class="px-1 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700 w-16">
                <div class="leading-tight">
                  <div>Avg Rug</div>
                  <div>Time</div>
                  <div>(Secs)</div>
                </div>
              </th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[360px] border border-gray-700">Multiplier Scores</th>
              <th rowspan="2" v-if="showWhatIfColumn" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">
                <div class="flex items-center justify-center gap-1">
                  <span>What If PNL</span>
                  <button
                    @click="showWhatIfColumn = false"
                    class="text-gray-500 hover:text-gray-300 transition"
                    title="Hide column"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              </th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Final Score</th>
            </tr>
            <!-- Bottom row with individual column headers -->
            <tr>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">25th</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">50th</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">75th</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">90th</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Buy Count</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Buy Sol Amount</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Sell Count</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Sell Sol Amount</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">1st Buy</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">2nd Buy</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">3rd Buy</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <!-- Empty State -->
            <tr v-if="!loading && wallets.length === 0">
              <td :colspan="showWhatIfColumn ? 21 : 20" class="px-2 py-8 text-center">
                <p class="text-gray-400 text-xs font-semibold mb-1">No creator wallets found</p>
                <p class="text-gray-500 text-[10px]">Creator wallets will appear here once tokens are tracked</p>
              </td>
            </tr>
            <!-- Wallet Rows -->
            <tr
              v-for="wallet in wallets"
              :key="wallet.address"
              class="hover:bg-gray-800/50 transition"
            >
              <td class="px-2 py-1.5 whitespace-nowrap border border-gray-700">
                <div class="flex items-center gap-1.5">
                  <button
                    @click="copyToClipboard(wallet.address)"
                    class="p-0.5 hover:bg-gray-700 rounded transition flex-shrink-0"
                    :class="copiedAddress === wallet.address ? 'text-green-400' : 'text-gray-400 hover:text-purple-400'"
                    :title="copiedAddress === wallet.address ? 'Copied!' : 'Copy wallet address'"
                  >
                    <span class="w-3 h-3 inline-flex items-center justify-center" v-html="processSvg(copiedAddress === wallet.address ? checkIconSvg : copyIconSvg, 'w-3 h-3')"></span>
                  </button>
                  <div class="text-[10px] text-gray-400 font-mono">{{ formatAddress(wallet.address) }}</div>
                </div>
              </td>
              <td class="px-1 py-1.5 whitespace-nowrap text-right border border-gray-700 w-14">
                <div class="text-xs font-semibold text-gray-200">
                  {{ wallet.totalTokens }}<span class="text-gray-500 ml-1">({{ getValidTokenCount(wallet) }})</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-green-400">{{ wallet.bondedTokens }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold" :class="getWinRateColor(wallet.winRate)">
                  {{ wallet.winRate.toFixed(2) }}%<span v-if="viewMode === 'score'" class="text-gray-500 ml-1">({{ wallet.scores.winRateScore.toFixed(0) }})</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-gray-200">
                  <span v-if="wallet.avgAthMcap !== null">
                    ${{ formatCurrency(wallet.avgAthMcap) }}
                    <span v-if="wallet.athMcapPercentileRank !== null" class="text-gray-500 ml-1">
                      ({{ wallet.athMcapPercentileRank.toFixed(1) }}%<span v-if="viewMode === 'score'">, Score: {{ wallet.scores.avgAthMcapScore.toFixed(0) }}</span>)
                    </span>
                    <span v-else-if="viewMode === 'score'" class="text-gray-500 ml-1">(Score: {{ wallet.scores.avgAthMcapScore.toFixed(0) }})</span>
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-gray-200">
                  <span v-if="wallet.medianAthMcap !== null">
                    ${{ formatCurrency(wallet.medianAthMcap) }}<span v-if="viewMode === 'score'" class="text-gray-500 ml-1">({{ wallet.scores.medianAthMcapScore.toFixed(0) }})</span>
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- ATH MCap Percentiles -->
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentileRank !== null && wallet.athMcapPercentileRank <= 25" class="text-green-400">✓</span>
                  <span v-else-if="wallet.athMcapPercentileRank !== null" class="text-gray-500">-</span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentileRank !== null && wallet.athMcapPercentileRank > 25 && wallet.athMcapPercentileRank <= 50" class="text-green-400">✓</span>
                  <span v-else-if="wallet.athMcapPercentileRank !== null" class="text-gray-500">-</span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentileRank !== null && wallet.athMcapPercentileRank > 50 && wallet.athMcapPercentileRank <= 75" class="text-green-400">✓</span>
                  <span v-else-if="wallet.athMcapPercentileRank !== null" class="text-gray-500">-</span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentileRank !== null && wallet.athMcapPercentileRank > 75" class="text-green-400">✓</span>
                  <span v-else-if="wallet.athMcapPercentileRank !== null" class="text-gray-500">-</span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Avg Buy Count -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-gray-200">
                  <span v-if="wallet.buySellStats">
                    {{ Math.round(wallet.buySellStats.avgBuyCount) }}
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Avg Buy Sol Amount -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-gray-200">
                  <span v-if="wallet.buySellStats">
                    {{ wallet.buySellStats.avgBuyTotalSol.toFixed(2) }}
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Avg Sell Count -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-gray-200">
                  <span v-if="wallet.buySellStats">
                    {{ Math.round(wallet.buySellStats.avgSellCount) }}
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Avg Sell Sol Amount -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold text-gray-200">
                  <span v-if="wallet.buySellStats">
                    {{ wallet.buySellStats.avgSellTotalSol.toFixed(2) }}
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Expected ROI 1st Buy -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.expectedROI">
                    <span :class="getRoiColor(wallet.expectedROI.avgRoi1stBuy)">
                      {{ wallet.expectedROI.avgRoi1stBuy >= 0 ? '+' : '' }}{{ wallet.expectedROI.avgRoi1stBuy.toFixed(2) }}%
                    </span>
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Expected ROI 2nd Buy -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.expectedROI">
                    <span :class="getRoiColor(wallet.expectedROI.avgRoi2ndBuy)">
                      {{ wallet.expectedROI.avgRoi2ndBuy >= 0 ? '+' : '' }}{{ wallet.expectedROI.avgRoi2ndBuy.toFixed(2) }}%
                    </span>
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <!-- Expected ROI 3rd Buy -->
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.expectedROI">
                    <span :class="getRoiColor(wallet.expectedROI.avgRoi3rdBuy)">
                      {{ wallet.expectedROI.avgRoi3rdBuy >= 0 ? '+' : '' }}{{ wallet.expectedROI.avgRoi3rdBuy.toFixed(2) }}%
                    </span>
                  </span>
                  <span v-else class="text-gray-500">N/A</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold" :class="wallet.avgRugRate >= 50 ? 'text-red-400' : wallet.avgRugRate >= 30 ? 'text-yellow-400' : 'text-gray-400'">
                  {{ wallet.avgRugRate?.toFixed(2) || '0.00' }}%<span v-if="viewMode === 'score'" class="text-gray-500 ml-1">({{ wallet.scores.avgRugRateScore?.toFixed(0) || '0' }})</span>
                </div>
              </td>
              <td class="px-1 py-1.5 text-right border border-gray-700 w-16">
                <div v-if="wallet.avgRugTime !== null && wallet.avgRugTime !== undefined">
                  <div class="text-xs font-semibold" :class="wallet.avgRugTime <= 5 ? 'text-red-400' : wallet.avgRugTime <= 15 ? 'text-yellow-400' : 'text-green-400'">
                    {{ wallet.avgRugTime.toFixed(2) }}s<span v-if="viewMode === 'score'" class="text-gray-500 ml-1">({{ wallet.scores.timeBucketRugRateScore?.toFixed(0) || '0' }})</span>
                  </div>
                </div>
                <div v-else class="text-xs text-gray-500">N/A</div>
              </td>
              <td class="px-2 py-1.5 text-right min-w-[360px] border border-gray-700">
                <div class="flex items-center gap-0.5 flex-wrap justify-end w-full">
                  <span 
                    v-for="multiplier in [1.5, 2, 3, 5, 10]" 
                    :key="multiplier"
                    class="text-[9px] px-1 py-0.5 rounded bg-gray-800/60 border border-gray-700/60 whitespace-nowrap cursor-pointer transition-all hover:bg-gray-700/80 hover:border-gray-600/80 hover:scale-105"
                    :class="viewMode === 'score' ? getMultiplierScoreColor(wallet.scores.individualMultiplierScores[multiplier] || 0) : 'text-gray-300'"
                    :title="viewMode === 'score' 
                      ? `${multiplier}x multiplier score: ${(wallet.scores.individualMultiplierScores[multiplier] || 0).toFixed(2)}`
                      : `${multiplier}x: ${(wallet.multiplierPercentages[multiplier] || 0).toFixed(2)}% of tokens`"
                  >
                    <span class="text-gray-400">{{ multiplier }}x</span>: 
                    <span class="font-semibold">
                      <template v-if="viewMode === 'data'">
                        {{ (wallet.multiplierPercentages[multiplier] || 0).toFixed(1) }}%
                      </template>
                      <template v-else>
                        {{ (wallet.scores.individualMultiplierScores[multiplier] || 0).toFixed(1) }}
                      </template>
                    </span>
                  </span>
                  <span v-if="viewMode === 'score'" class="text-[9px] px-1 py-0.5 rounded bg-purple-600/20 border border-purple-500/30 whitespace-nowrap text-gray-300">
                    <span class="text-gray-400">Total:</span> <span :class="getScoreColor(wallet.scores.multiplierScore)" class="font-bold">{{ wallet.scores.multiplierScore.toFixed(2) }}</span>
                  </span>
                </div>
              </td>
              <td v-if="showWhatIfColumn" class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div v-if="wallet.whatIfPnl" class="text-xs font-semibold">
                  <div class="text-gray-200">${{ formatCurrency(wallet.whatIfPnl.avgPnl) }}</div>
                  <div class="text-[10px]" :class="getRoiColor(wallet.whatIfPnl.avgPnlPercent)">
                    {{ wallet.whatIfPnl.avgPnlPercent >= 0 ? '+' : '' }}{{ wallet.whatIfPnl.avgPnlPercent.toFixed(2) }}%
                  </div>
                  <div class="text-[9px] text-gray-500">({{ wallet.whatIfPnl.tokensSimulated }} tokens)</div>
                </div>
                <div v-else class="text-xs text-gray-500">N/A</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
                <div class="text-xs font-semibold" :class="getScoreColor(wallet.scores.finalScore)">
                  {{ wallet.scores.finalScore.toFixed(2) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Controls -->
      <div v-if="pagination.total > 0" class="px-4 py-3 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
        <div class="text-xs text-gray-400">
          <span v-if="itemsPerPage === 'all'">
            Showing all {{ pagination.total }} wallet{{ pagination.total !== 1 ? 's' : '' }}
          </span>
          <span v-else>
            Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} wallets
          </span>
        </div>
        <div v-if="pagination.totalPages > 1" class="flex items-center gap-2">
          <button
            @click="goToPage(1)"
            :disabled="pagination.page === 1"
            class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            @click="goToPage(pagination.page - 1)"
            :disabled="pagination.page === 1"
            class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div class="flex items-center gap-1">
            <button
              v-for="page in visiblePages"
              :key="page"
              @click="goToPage(page)"
              :class="[
                'px-2 py-1 text-xs rounded transition min-w-[32px]',
                page === pagination.page
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              ]"
            >
              {{ page }}
            </button>
          </div>
          <button
            @click="goToPage(pagination.page + 1)"
            :disabled="pagination.page === pagination.totalPages"
            class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            @click="goToPage(pagination.totalPages)"
            :disabled="pagination.page === pagination.totalPages"
            class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    </div>

    <!-- Save Preset Dialog -->
    <div
      v-if="showSavePresetDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showSavePresetDialog = false"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Save Filter Preset</h3>
          <button
            @click="showSavePresetDialog = false"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form @submit.prevent="saveFilterPreset" class="space-y-4">
          <div>
            <label for="presetName" class="block text-sm font-semibold text-gray-300 mb-1.5">
              Preset Name
            </label>
            <input
              id="presetName"
              v-model="newPresetName"
              type="text"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
              placeholder="Enter preset name"
            />
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              @click="showSavePresetDialog = false"
              class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCreatorWalletsAnalytics, type CreatorWallet, type PaginationInfo } from '../services/creatorWallets'
import { getAppliedSettings, type ScoringSettings } from '../services/settings'
import copyIconSvg from '../icons/copy.svg?raw'
import checkIconSvg from '../icons/check.svg?raw'
import * as XLSX from 'xlsx'

// Helper function to process SVG for inline rendering
const processSvg = (svg: string, sizeClass: string = 'w-4 h-4') => {
  return svg.replace(
    '<svg',
    `<svg class="${sizeClass}" style="display: block;"`
  )
}

const wallets = ref<CreatorWallet[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const copiedAddress = ref<string | null>(null)
const itemsPerPage = ref<number | string>(20)
const viewMode = ref<'data' | 'score'>('data')
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})
const refreshing = ref(false)

// Filter state
const filtersExpanded = ref(false)
const scoringSettings = ref<ScoringSettings | null>(null)
const showAddFilterDialog = ref(false)
const newFilterType = ref<string>('')
const addedFilterTypes = ref<Set<string>>(new Set())
const filterSearchQuery = ref<string>('')

// What If state
const whatIfExpanded = ref(false)
const showWhatIfColumn = ref(false)
const whatIfSettings = ref<{
  buyPosition: number;
  sellStrategy: 'time' | 'pnl' | 'multiple';
  sellAtSeconds?: number;
  sellAtPnlPercent?: number;
  multipleSells?: Array<{ type: 'time' | 'pnl'; value: number; sizePercent: number }>;
}>({
  buyPosition: 2,
  sellStrategy: 'time',
  sellAtSeconds: 5,
  multipleSells: []
})

// Tree expansion state
const expandedGroups = ref({
  tokenCount: true,
  winRate: false,
  avgMcap: false,
  medianMcap: false,
  avgBuySells: false,
  expectedROI: false,
  multiplierScores: false
})

// New filter configuration state
const newFilterConfig = ref({
  totalTokens: { min: undefined as number | undefined, max: undefined as number | undefined },
  bondedTokens: { min: undefined as number | undefined, max: undefined as number | undefined },
  winRatePercent: { min: undefined as number | undefined, max: undefined as number | undefined },
  winRateScore: { min: undefined as number | undefined, max: undefined as number | undefined },
  avgMcapAmount: { min: undefined as number | undefined, max: undefined as number | undefined },
  avgMcapPercentile: { min: undefined as number | undefined, max: undefined as number | undefined },
  avgMcapScore: { min: undefined as number | undefined, max: undefined as number | undefined },
  medianMcapAmount: { min: undefined as number | undefined, max: undefined as number | undefined },
  medianMcapScore: { min: undefined as number | undefined, max: undefined as number | undefined }
})

interface FilterPreset {
  id: string
  name: string
  filters: any
}

const filterPresets = ref<FilterPreset[]>([])
const selectedFilterPreset = ref<string>('')
const showSavePresetDialog = ref(false)
const newPresetName = ref('')

interface Filters {
  totalTokens: { min?: number; max?: number }
  bondedTokens: { min?: number; max?: number }
  winRate: Array<{
    type: 'percent' | 'score'
    min?: number
    max?: number
  }>
  avgMcap: Array<{
    type: 'mcap' | 'percentile' | 'score'
    min?: number
    max?: number
  }>
  medianMcap: Array<{
    type: 'mcap' | 'score'
    min?: number
    max?: number
  }>
  avgBuySells: Array<{
    type: 'buyCount' | 'buySol' | 'sellCount' | 'sellSol'
    min?: number
    max?: number
  }>
  expectedROI: Array<{
    type: '1st' | '2nd' | '3rd'
    min?: number
    max?: number
  }>
  rugRate: { min?: number; max?: number }
  avgRugTime: { min?: number; max?: number }
  finalScore: { min?: number; max?: number }
  multiplierScores: Array<{
    multiplier: number
    type: 'percent' | 'score'
    min?: number
    max?: number
  }>
}

const filters = ref<Filters>({
  totalTokens: {},
  bondedTokens: {},
  winRate: [],
  avgMcap: [],
  medianMcap: [],
  avgBuySells: [],
  expectedROI: [],
  rugRate: {},
  avgRugTime: {},
  finalScore: {},
  multiplierScores: []
})

// Load filter presets from localStorage
const loadFilterPresets = () => {
  try {
    const stored = localStorage.getItem('creatorWalletFilterPresets')
    if (stored) {
      filterPresets.value = JSON.parse(stored)
    }
  } catch (e) {
    console.error('Error loading filter presets:', e)
  }
}

// Save filter presets to localStorage
const saveFilterPresets = () => {
  try {
    localStorage.setItem('creatorWalletFilterPresets', JSON.stringify(filterPresets.value))
  } catch (e) {
    console.error('Error saving filter presets:', e)
  }
}

// Load scoring settings to get score ranges
const loadScoringSettings = async () => {
  try {
    const applied = await getAppliedSettings()
    if (applied.settings) {
      scoringSettings.value = applied.settings
    }
  } catch (e) {
    console.error('Error loading scoring settings:', e)
  }
}


// Select filter type from tree
const selectFilterType = (filterType: string) => {
  newFilterType.value = filterType
}

// Check if a filter item should be shown based on search
const shouldShowFilterItem = (itemName: string, groupName?: string): boolean => {
  if (!filterSearchQuery.value) return true
  const query = filterSearchQuery.value.toLowerCase().trim()
  const itemMatches = itemName.toLowerCase().includes(query)
  const groupMatches = groupName ? groupName.toLowerCase().includes(query) : false
  return itemMatches || groupMatches
}

// Check if the currently selected filter is already added
const isSelectedFilterAlreadyAdded = computed(() => {
  if (!newFilterType.value) return false
  
  switch (newFilterType.value) {
    case 'totalTokens':
      return isFilterAdded('totalTokens')
    case 'bondedTokens':
      return isFilterAdded('bondedTokens')
    case 'rugRate':
      return isFilterAdded('rugRate')
    case 'avgRugTime':
      return isFilterAdded('avgRugTime')
    case 'finalScore':
      return isFilterAdded('finalScore')
    case 'winRatePercent':
      return isWinRateFilterAdded('percent')
    case 'winRateScore':
      return isWinRateFilterAdded('score')
    case 'avgMcapAmount':
      return isAvgMcapFilterAdded('mcap')
    case 'avgMcapPercentile':
      return isAvgMcapFilterAdded('percentile')
    case 'avgMcapScore':
      return isAvgMcapFilterAdded('score')
    case 'medianMcapAmount':
      return isMedianMcapFilterAdded('mcap')
    case 'medianMcapScore':
      return isMedianMcapFilterAdded('score')
    case 'avgBuyCount':
      return isAvgBuySellsFilterAdded('buyCount')
    case 'avgBuySol':
      return isAvgBuySellsFilterAdded('buySol')
    case 'avgSellCount':
      return isAvgBuySellsFilterAdded('sellCount')
    case 'avgSellSol':
      return isAvgBuySellsFilterAdded('sellSol')
    case 'expectedROI1st':
      return isExpectedROIFilterAdded('1st')
    case 'expectedROI2nd':
      return isExpectedROIFilterAdded('2nd')
    case 'expectedROI3rd':
      return isExpectedROIFilterAdded('3rd')
    default:
      // Handle multiplier filters
      if (newFilterType.value.startsWith('multiplier')) {
        const match = newFilterType.value.match(/^multiplier([\d.]+)(Percent|Score)$/)
        if (match) {
          const multiplier = parseFloat(match[1])
          const type = match[2] === 'Percent' ? 'percent' : 'score'
          return isMultiplierFilterAdded(multiplier, type)
        }
      }
      return false
  }
})

// Check if a filter is already added
const isFilterAdded = (filterType: string): boolean => {
  return addedFilterTypes.value.has(filterType)
}

// Check if a win rate filter type is already added
const isWinRateFilterAdded = (filterType: 'percent' | 'score'): boolean => {
  return filters.value.winRate.some(f => f.type === filterType)
}

// Check if an avg mcap filter type is already added
const isAvgMcapFilterAdded = (filterType: 'mcap' | 'percentile' | 'score'): boolean => {
  return filters.value.avgMcap.some(f => f.type === filterType)
}

// Check if a median mcap filter type is already added
const isMedianMcapFilterAdded = (filterType: 'mcap' | 'score'): boolean => {
  return filters.value.medianMcap.some(f => f.type === filterType)
}

// Check if an avg buy/sells filter type is already added
const isAvgBuySellsFilterAdded = (filterType: 'buyCount' | 'buySol' | 'sellCount' | 'sellSol'): boolean => {
  return filters.value.avgBuySells.some(f => f.type === filterType)
}

// Check if an expected ROI filter type is already added
const isExpectedROIFilterAdded = (filterType: '1st' | '2nd' | '3rd'): boolean => {
  return filters.value.expectedROI.some(f => f.type === filterType)
}

// Check if a multiplier filter is already added
const isMultiplierFilterAdded = (multiplier: number, filterType: 'percent' | 'score'): boolean => {
  return filters.value.multiplierScores.some(f => f.multiplier === multiplier && f.type === filterType)
}

// Check if multiplier group should be shown
const shouldShowMultiplierGroup = (): boolean => {
  if (!scoringSettings.value?.multiplierConfigs || scoringSettings.value.multiplierConfigs.length === 0) {
    return false
  }
  if (!filterSearchQuery.value) return true
  
  return scoringSettings.value.multiplierConfigs.some(config => 
    shouldShowFilterItem(`Multiplier ${config.multiplier}x (Percentage)`, 'Multiplier Scores') ||
    shouldShowFilterItem(`Multiplier ${config.multiplier}x (Score)`, 'Multiplier Scores')
  )
}

// Get label for avg buy/sells filter
const getAvgBuySellsFilterLabel = (type: 'buyCount' | 'buySol' | 'sellCount' | 'sellSol'): string => {
  switch (type) {
    case 'buyCount':
      return 'Buy Count'
    case 'buySol':
      return 'Buy SOLs'
    case 'sellCount':
      return 'Sell Count'
    case 'sellSol':
      return 'Sell SOLs'
    default:
      return ''
  }
}

// Check if there are any visible filter items when searching
const hasVisibleFilterItems = computed(() => {
  if (!filterSearchQuery.value) return true
  
  const hasTokenCount = shouldShowFilterItem('Total Tokens', 'Token Count') || shouldShowFilterItem('Bonded Tokens', 'Token Count')
  const hasWinRate = shouldShowFilterItem('Win Rate (Percentage)', 'Win Rate') || shouldShowFilterItem('Win Rate (Score)', 'Win Rate')
  const hasAvgMcap = shouldShowFilterItem('Average MCap (Amount)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Percentile)', 'Average Market Cap') || shouldShowFilterItem('Average MCap (Score)', 'Average Market Cap')
  const hasMedianMcap = shouldShowFilterItem('Median MCap (Amount)', 'Median ATH Market Cap') || shouldShowFilterItem('Median MCap (Score)', 'Median ATH Market Cap')
  const hasAvgBuySells = shouldShowFilterItem('Buy Count', 'Avg Buy/Sells') || shouldShowFilterItem('Buy SOLs', 'Avg Buy/Sells') || shouldShowFilterItem('Sell Count', 'Avg Buy/Sells') || shouldShowFilterItem('Sell SOLs', 'Avg Buy/Sells')
  const hasExpectedROI = shouldShowFilterItem('Expected ROI (1st)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (2nd)', 'Expected ROI') || shouldShowFilterItem('Expected ROI (3rd)', 'Expected ROI')
  const hasRugRate = shouldShowFilterItem('Rug Rate', 'Rug Rate')
  const hasAvgRugTime = shouldShowFilterItem('Avg Rug Time', 'Avg Rug Time')
  const hasFinalScore = shouldShowFilterItem('Final Score', 'Final Score')
  const hasMultiplierScores = shouldShowMultiplierGroup()
  
  return hasTokenCount || hasWinRate || hasAvgMcap || hasMedianMcap || hasAvgBuySells || hasExpectedROI || hasRugRate || hasAvgRugTime || hasFinalScore || hasMultiplierScores
})

// Confirm adding filter from dialog
const confirmAddFilter = () => {
  if (!newFilterType.value) return

  switch (newFilterType.value) {
    case 'totalTokens':
      filters.value.totalTokens = {
        min: undefined,
        max: undefined
      }
      addedFilterTypes.value.add('totalTokens')
      break
    case 'bondedTokens':
      filters.value.bondedTokens = {
        min: undefined,
        max: undefined
      }
      addedFilterTypes.value.add('bondedTokens')
      break
    case 'rugRate':
      filters.value.rugRate = {
        min: undefined,
        max: undefined
      }
      addedFilterTypes.value.add('rugRate')
      break
    case 'avgRugTime':
      filters.value.avgRugTime = {
        min: undefined,
        max: undefined
      }
      addedFilterTypes.value.add('avgRugTime')
      break
    case 'finalScore':
      filters.value.finalScore = {
        min: undefined,
        max: undefined
      }
      addedFilterTypes.value.add('finalScore')
      break
    case 'winRatePercent':
      filters.value.winRate.push({
        type: 'percent',
        min: undefined,
        max: undefined
      })
      break
    case 'winRateScore':
      filters.value.winRate.push({
        type: 'score',
        min: undefined,
        max: undefined
      })
      break
    case 'avgMcapAmount':
      filters.value.avgMcap.push({
        type: 'mcap',
        min: undefined,
        max: undefined
      })
      break
    case 'avgMcapPercentile':
      filters.value.avgMcap.push({
        type: 'percentile',
        min: undefined,
        max: undefined
      })
      break
    case 'avgMcapScore':
      filters.value.avgMcap.push({
        type: 'score',
        min: undefined,
        max: undefined
      })
      break
    case 'medianMcapAmount':
      filters.value.medianMcap.push({
        type: 'mcap',
        min: undefined,
        max: undefined
      })
      break
    case 'medianMcapScore':
      filters.value.medianMcap.push({
        type: 'score',
        min: undefined,
        max: undefined
      })
      break
    case 'avgBuyCount':
      filters.value.avgBuySells.push({
        type: 'buyCount',
        min: undefined,
        max: undefined
      })
      break
    case 'avgBuySol':
      filters.value.avgBuySells.push({
        type: 'buySol',
        min: undefined,
        max: undefined
      })
      break
    case 'avgSellCount':
      filters.value.avgBuySells.push({
        type: 'sellCount',
        min: undefined,
        max: undefined
      })
      break
    case 'avgSellSol':
      filters.value.avgBuySells.push({
        type: 'sellSol',
        min: undefined,
        max: undefined
      })
      break
    case 'expectedROI1st':
      filters.value.expectedROI.push({
        type: '1st',
        min: undefined,
        max: undefined
      })
      break
    case 'expectedROI2nd':
      filters.value.expectedROI.push({
        type: '2nd',
        min: undefined,
        max: undefined
      })
      break
    case 'expectedROI3rd':
      filters.value.expectedROI.push({
        type: '3rd',
        min: undefined,
        max: undefined
      })
      break
    default:
      // Handle multiplier filters (format: multiplier1.5Percent, multiplier2Score, etc.)
      if (newFilterType.value.startsWith('multiplier')) {
        const match = newFilterType.value.match(/^multiplier([\d.]+)(Percent|Score)$/)
        if (match) {
          const multiplier = parseFloat(match[1])
          const type = match[2] === 'Percent' ? 'percent' : 'score'
          filters.value.multiplierScores.push({
            multiplier,
            type,
            min: undefined,
            max: undefined
          })
        }
      }
      break
  }

  cancelAddFilter()
}

// Cancel adding filter
const cancelAddFilter = () => {
  showAddFilterDialog.value = false
  newFilterType.value = ''
  filterSearchQuery.value = ''
  // Reset all config values
  newFilterConfig.value = {
    totalTokens: { min: undefined, max: undefined },
    bondedTokens: { min: undefined, max: undefined },
    winRatePercent: { min: undefined, max: undefined },
    winRateScore: { min: undefined, max: undefined },
    avgMcapAmount: { min: undefined, max: undefined },
    avgMcapPercentile: { min: undefined, max: undefined },
    avgMcapScore: { min: undefined, max: undefined },
    medianMcapAmount: { min: undefined, max: undefined },
    medianMcapScore: { min: undefined, max: undefined }
  }
  // Reset tree expansion
  expandedGroups.value = {
    tokenCount: true,
    winRate: false,
    avgMcap: false,
    medianMcap: false,
    avgBuySells: false,
    expectedROI: false,
    multiplierScores: false
  }
}

// Remove a specific filter
const removeFilter = (filterType: 'totalTokens' | 'bondedTokens' | 'rugRate' | 'avgRugTime' | 'finalScore') => {
  switch (filterType) {
    case 'totalTokens':
      filters.value.totalTokens = {}
      addedFilterTypes.value.delete('totalTokens')
      break
    case 'bondedTokens':
      filters.value.bondedTokens = {}
      addedFilterTypes.value.delete('bondedTokens')
      break
    case 'rugRate':
      filters.value.rugRate = {}
      addedFilterTypes.value.delete('rugRate')
      break
    case 'avgRugTime':
      filters.value.avgRugTime = {}
      addedFilterTypes.value.delete('avgRugTime')
      break
    case 'finalScore':
      filters.value.finalScore = {}
      addedFilterTypes.value.delete('finalScore')
      break
  }
}

// Remove win rate filter
const removeWinRateFilter = (index: number) => {
  filters.value.winRate.splice(index, 1)
}

// Remove average market cap filter
const removeAvgMcapFilter = (index: number) => {
  filters.value.avgMcap.splice(index, 1)
}

// Remove median mcap filter
const removeMedianMcapFilter = (index: number) => {
  filters.value.medianMcap.splice(index, 1)
}

// Remove avg buy/sells filter
const removeAvgBuySellsFilter = (index: number) => {
  filters.value.avgBuySells.splice(index, 1)
}

// Remove expected ROI filter
const removeExpectedROIFilter = (index: number) => {
  filters.value.expectedROI.splice(index, 1)
}

// Remove multiplier filter
const removeMultiplierFilter = (index: number) => {
  filters.value.multiplierScores.splice(index, 1)
}

// Clear all filters
const clearFilters = () => {
  filters.value = {
    totalTokens: {},
    bondedTokens: {},
    winRate: [],
    avgMcap: [],
    medianMcap: [],
    avgBuySells: [],
    expectedROI: [],
    rugRate: {},
    avgRugTime: {},
    finalScore: {},
    multiplierScores: []
  }
  addedFilterTypes.value.clear()
  selectedFilterPreset.value = ''
  applyFilters()
}

// Check if filters are active
const hasActiveFilters = computed(() => {
  return !!(
    addedFilterTypes.value.has('totalTokens') ||
    addedFilterTypes.value.has('bondedTokens') ||
    addedFilterTypes.value.has('rugRate') ||
    addedFilterTypes.value.has('avgRugTime') ||
    addedFilterTypes.value.has('finalScore') ||
    filters.value.winRate.length > 0 ||
    filters.value.avgMcap.length > 0 ||
    filters.value.medianMcap.length > 0 ||
    filters.value.avgBuySells.length > 0 ||
    filters.value.expectedROI.length > 0 ||
    filters.value.multiplierScores.length > 0
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (addedFilterTypes.value.has('totalTokens')) count++
  if (addedFilterTypes.value.has('bondedTokens')) count++
  if (addedFilterTypes.value.has('rugRate')) count++
  if (addedFilterTypes.value.has('avgRugTime')) count++
  if (addedFilterTypes.value.has('finalScore')) count++
  count += filters.value.winRate.length
  count += filters.value.avgMcap.length
  count += filters.value.medianMcap.length
  count += filters.value.avgBuySells.length
  count += filters.value.expectedROI.length
  count += filters.value.multiplierScores.length
  return count
})

// Load filter preset
const loadFilterPreset = () => {
  if (!selectedFilterPreset.value) return
  const preset = filterPresets.value.find(p => p.id === selectedFilterPreset.value)
  if (preset) {
    filters.value = JSON.parse(JSON.stringify(preset.filters))
    // Update addedFilterTypes based on loaded filters
    addedFilterTypes.value.clear()
    if (filters.value.totalTokens && (filters.value.totalTokens.min !== undefined || filters.value.totalTokens.max !== undefined)) {
      addedFilterTypes.value.add('totalTokens')
    }
    if (filters.value.bondedTokens && (filters.value.bondedTokens.min !== undefined || filters.value.bondedTokens.max !== undefined)) {
      addedFilterTypes.value.add('bondedTokens')
    }
    if (filters.value.rugRate && (filters.value.rugRate.min !== undefined || filters.value.rugRate.max !== undefined)) {
      addedFilterTypes.value.add('rugRate')
    }
    if (filters.value.avgRugTime && (filters.value.avgRugTime.min !== undefined || filters.value.avgRugTime.max !== undefined)) {
      addedFilterTypes.value.add('avgRugTime')
    }
    if (filters.value.finalScore && (filters.value.finalScore.min !== undefined || filters.value.finalScore.max !== undefined)) {
      addedFilterTypes.value.add('finalScore')
    }
    applyFilters()
  }
}

// Save filter preset
const saveFilterPreset = () => {
  if (!newPresetName.value.trim()) {
    alert('Please enter a preset name')
    return
  }
  const newPreset: FilterPreset = {
    id: Date.now().toString(),
    name: newPresetName.value.trim(),
    filters: JSON.parse(JSON.stringify(filters.value))
  }
  filterPresets.value.push(newPreset)
  saveFilterPresets()
  selectedFilterPreset.value = newPreset.id
  newPresetName.value = ''
  showSavePresetDialog.value = false
}

// Remove filter preset
const removeFilterPreset = () => {
  if (!selectedFilterPreset.value) return
  
  if (confirm('Are you sure you want to remove this preset?')) {
    const index = filterPresets.value.findIndex(p => p.id === selectedFilterPreset.value)
    if (index !== -1) {
      filterPresets.value.splice(index, 1)
      saveFilterPresets()
      selectedFilterPreset.value = ''
      // Clear filters when preset is removed
      clearFilters()
    }
  }
}

// Apply filters
const applyFilters = () => {
  pagination.value.page = 1
  loadWallets()
}

// What If functions
const getTotalMultipleSellPercent = (): number => {
  if (!whatIfSettings.value.multipleSells || whatIfSettings.value.multipleSells.length === 0) {
    return 0
  }
  return whatIfSettings.value.multipleSells.reduce((sum, sell) => {
    return sum + (sell.sizePercent || 0)
  }, 0)
}

const getMultipleSellValidationClass = (): string => {
  const total = getTotalMultipleSellPercent()
  if (total > 100) {
    return 'border-red-500 focus:ring-red-500'
  }
  return ''
}

const applyWhatIfSettings = () => {
  if (!whatIfSettings.value.buyPosition || !whatIfSettings.value.sellStrategy) {
    alert('Please configure buy position and sell strategy')
    return
  }
  
  if (whatIfSettings.value.sellStrategy === 'time' && !whatIfSettings.value.sellAtSeconds) {
    alert('Please set sell at seconds')
    return
  }
  
  if (whatIfSettings.value.sellStrategy === 'pnl' && !whatIfSettings.value.sellAtPnlPercent) {
    alert('Please set sell at PNL percent')
    return
  }
  
  if (whatIfSettings.value.sellStrategy === 'multiple') {
    if (!whatIfSettings.value.multipleSells || whatIfSettings.value.multipleSells.length === 0) {
      alert('Please add at least one multiple sell')
      return
    }
    
    // Validate that all sells have type, value, and size percent
    for (let i = 0; i < whatIfSettings.value.multipleSells.length; i++) {
      const sell = whatIfSettings.value.multipleSells[i]
      if (!sell.type || (sell.type !== 'time' && sell.type !== 'pnl')) {
        alert(`Please select a type (Time or PNL) for sell ${i + 1}`)
        return
      }
      if (sell.value === undefined || sell.value === null || sell.value < 0) {
        alert(`Please set ${sell.type === 'time' ? 'seconds' : 'PNL %'} for sell ${i + 1}`)
        return
      }
      if (sell.type === 'time' && sell.value > 15) {
        alert(`Seconds for sell ${i + 1} must be between 0 and 15`)
        return
      }
      if (!sell.sizePercent && sell.sizePercent !== 0) {
        alert(`Please set size percent for sell ${i + 1}`)
        return
      }
      if (sell.sizePercent < 0 || sell.sizePercent > 100) {
        alert(`Size percent for sell ${i + 1} must be between 0 and 100`)
        return
      }
    }
    
    // Validate total percentage doesn't exceed 100%
    const total = getTotalMultipleSellPercent()
    if (total > 100) {
      alert(`Total sell percentage (${total.toFixed(1)}%) exceeds 100%. Please adjust the percentages.`)
      return
    }
  }
  
  showWhatIfColumn.value = true
  pagination.value.page = 1
  loadWallets()
}


const addMultipleSell = () => {
  if (!whatIfSettings.value.multipleSells) {
    whatIfSettings.value.multipleSells = []
  }
  whatIfSettings.value.multipleSells.push({ type: 'time', value: 3, sizePercent: 50 })
}

const removeMultipleSell = (index: number) => {
  if (whatIfSettings.value.multipleSells) {
    whatIfSettings.value.multipleSells.splice(index, 1)
  }
}

const toggleWhatIfColumn = () => {
  showWhatIfColumn.value = !showWhatIfColumn.value
  // Just toggle visibility, no API call needed
}

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, pagination.value.page - Math.floor(maxVisible / 2))
  let end = Math.min(pagination.value.totalPages, start + maxVisible - 1)
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const formatAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

const getWinRateColor = (winRate: number): string => {
  if (winRate >= 70) return 'text-green-400'
  if (winRate >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '0'
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K'
  return value.toFixed(2)
}

const getScoreColor = (score: number): string => {
  if (score >= 8) return 'text-green-400'
  if (score >= 5) return 'text-yellow-400'
  if (score >= 0) return 'text-gray-400'
  return 'text-red-400'
}

const getMultiplierScoreColor = (score: number): string => {
  if (score > 0) return 'text-green-400'
  return 'text-gray-500'
}

const getValidTokenCount = (wallet: CreatorWallet): number => {
  return wallet.validTokenCount || 0
}

const getRoiColor = (roi: number): string => {
  if (roi > 15) return 'text-green-400'
  if (roi >= 5) return 'text-orange-400'
  return 'text-red-400'
}

const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      copiedAddress.value = text
      setTimeout(() => {
        copiedAddress.value = null
      }, 2000)
      return
    }
    
    // Fallback
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    document.body.appendChild(textArea)
    textArea.select()
    textArea.setSelectionRange(0, text.length)
    
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        copiedAddress.value = text
        setTimeout(() => {
          copiedAddress.value = null
        }, 2000)
      }
    } finally {
      document.body.removeChild(textArea)
    }
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'data' ? 'score' : 'data'
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    pagination.value.page = page
    loadWallets()
  }
}

const handleItemsPerPageChange = () => {
  pagination.value.page = 1
  if (itemsPerPage.value === 'all') {
    pagination.value.limit = 1000000
  } else {
    pagination.value.limit = itemsPerPage.value as number
  }
  loadWallets()
}

const loadWallets = async () => {
  loading.value = true
  error.value = null
  
  try {
    const limit = itemsPerPage.value === 'all' ? 1000000 : (itemsPerPage.value as number)
    
    // Build filter object
    const filterParams: any = {}
    
    if (filters.value.totalTokens.min !== undefined || filters.value.totalTokens.max !== undefined) {
      filterParams.totalTokens = {}
      if (filters.value.totalTokens.min !== undefined) {
        filterParams.totalTokens.min = filters.value.totalTokens.min
      }
      if (filters.value.totalTokens.max !== undefined) {
        filterParams.totalTokens.max = filters.value.totalTokens.max
      }
    }
    
    if (filters.value.bondedTokens.min !== undefined || filters.value.bondedTokens.max !== undefined) {
      filterParams.bondedTokens = {}
      if (filters.value.bondedTokens.min !== undefined) {
        filterParams.bondedTokens.min = filters.value.bondedTokens.min
      }
      if (filters.value.bondedTokens.max !== undefined) {
        filterParams.bondedTokens.max = filters.value.bondedTokens.max
      }
    }
    
    if (filters.value.winRate.length > 0) {
      filterParams.winRate = filters.value.winRate
    }
    
    if (filters.value.avgMcap.length > 0) {
      filterParams.avgMcap = filters.value.avgMcap
    }
    
    if (filters.value.medianMcap.length > 0) {
      filterParams.medianMcap = filters.value.medianMcap
    }
    
    if (filters.value.avgBuySells.length > 0) {
      filterParams.avgBuySells = filters.value.avgBuySells
    }
    
    if (filters.value.expectedROI.length > 0) {
      filterParams.expectedROI = filters.value.expectedROI
    }
    
    if (filters.value.rugRate.min !== undefined || filters.value.rugRate.max !== undefined) {
      filterParams.rugRate = {}
      if (filters.value.rugRate.min !== undefined) {
        filterParams.rugRate.min = filters.value.rugRate.min
      }
      if (filters.value.rugRate.max !== undefined) {
        filterParams.rugRate.max = filters.value.rugRate.max
      }
    }
    
    if (filters.value.avgRugTime.min !== undefined || filters.value.avgRugTime.max !== undefined) {
      filterParams.avgRugTime = {}
      if (filters.value.avgRugTime.min !== undefined) {
        filterParams.avgRugTime.min = filters.value.avgRugTime.min
      }
      if (filters.value.avgRugTime.max !== undefined) {
        filterParams.avgRugTime.max = filters.value.avgRugTime.max
      }
    }
    
    if (filters.value.finalScore.min !== undefined || filters.value.finalScore.max !== undefined) {
      filterParams.finalScore = {}
      if (filters.value.finalScore.min !== undefined) {
        filterParams.finalScore.min = filters.value.finalScore.min
      }
      if (filters.value.finalScore.max !== undefined) {
        filterParams.finalScore.max = filters.value.finalScore.max
      }
    }
    
    if (filters.value.multiplierScores.length > 0) {
      filterParams.multiplierScores = filters.value.multiplierScores
    }
    
    // Prepare What If settings if enabled
    const whatIfSettingsToSend = showWhatIfColumn.value && whatIfSettings.value.buyPosition && whatIfSettings.value.sellStrategy
      ? whatIfSettings.value
      : null
    
    const response = await getCreatorWalletsAnalytics(
      pagination.value.page,
      limit,
      false, // viewAll - can be made configurable later
      filterParams,
      whatIfSettingsToSend
    )
    wallets.value = response.wallets
    pagination.value = response.pagination
  } catch (err: any) {
    error.value = err.message || 'Failed to load creator wallets'
    console.error('Error loading creator wallets:', err)
  } finally {
    loading.value = false
  }
}

const handleRefresh = async () => {
  if (refreshing.value) {
    return
  }

  refreshing.value = true
  try {
    await loadWallets()
  } catch (err: any) {
    console.error('Error refreshing data:', err)
  } finally {
    refreshing.value = false
  }
}

const handleExport = async () => {
  try {
    // Fetch all wallets for export
    const limit = 1000000 // Large limit to get all data
    
    // Build filter object (same logic as loadWallets)
    const filterParams: any = {}
    
    if (filters.value.totalTokens.min !== undefined || filters.value.totalTokens.max !== undefined) {
      filterParams.totalTokens = {}
      if (filters.value.totalTokens.min !== undefined) {
        filterParams.totalTokens.min = filters.value.totalTokens.min
      }
      if (filters.value.totalTokens.max !== undefined) {
        filterParams.totalTokens.max = filters.value.totalTokens.max
      }
    }
    
    if (filters.value.bondedTokens.min !== undefined || filters.value.bondedTokens.max !== undefined) {
      filterParams.bondedTokens = {}
      if (filters.value.bondedTokens.min !== undefined) {
        filterParams.bondedTokens.min = filters.value.bondedTokens.min
      }
      if (filters.value.bondedTokens.max !== undefined) {
        filterParams.bondedTokens.max = filters.value.bondedTokens.max
      }
    }
    
    if (filters.value.winRate.length > 0) {
      filterParams.winRate = filters.value.winRate
    }
    
    if (filters.value.avgMcap.length > 0) {
      filterParams.avgMcap = filters.value.avgMcap
    }
    
    if (filters.value.medianMcap.length > 0) {
      filterParams.medianMcap = filters.value.medianMcap
    }
    
    if (filters.value.avgBuySells.length > 0) {
      filterParams.avgBuySells = filters.value.avgBuySells
    }
    
    if (filters.value.expectedROI.length > 0) {
      filterParams.expectedROI = filters.value.expectedROI
    }
    
    if (filters.value.rugRate.min !== undefined || filters.value.rugRate.max !== undefined) {
      filterParams.rugRate = {}
      if (filters.value.rugRate.min !== undefined) {
        filterParams.rugRate.min = filters.value.rugRate.min
      }
      if (filters.value.rugRate.max !== undefined) {
        filterParams.rugRate.max = filters.value.rugRate.max
      }
    }
    
    if (filters.value.avgRugTime.min !== undefined || filters.value.avgRugTime.max !== undefined) {
      filterParams.avgRugTime = {}
      if (filters.value.avgRugTime.min !== undefined) {
        filterParams.avgRugTime.min = filters.value.avgRugTime.min
      }
      if (filters.value.avgRugTime.max !== undefined) {
        filterParams.avgRugTime.max = filters.value.avgRugTime.max
      }
    }
    
    if (filters.value.finalScore.min !== undefined || filters.value.finalScore.max !== undefined) {
      filterParams.finalScore = {}
      if (filters.value.finalScore.min !== undefined) {
        filterParams.finalScore.min = filters.value.finalScore.min
      }
      if (filters.value.finalScore.max !== undefined) {
        filterParams.finalScore.max = filters.value.finalScore.max
      }
    }
    
    if (filters.value.multiplierScores.length > 0) {
      filterParams.multiplierScores = filters.value.multiplierScores
    }
    
    const whatIfSettingsToSend = showWhatIfColumn.value && whatIfSettings.value.buyPosition && whatIfSettings.value.sellStrategy
      ? whatIfSettings.value
      : null
    
    const response = await getCreatorWalletsAnalytics(
      1,
      limit,
      false,
      filterParams,
      whatIfSettingsToSend
    )
    
    const allWallets = response.wallets
    
    // Prepare data for Excel export
    const exportData = allWallets.map(wallet => ({
      'Wallet Address': wallet.address,
      'Total Tokens': wallet.totalTokens,
      'Valid Token Count': wallet.validTokenCount,
      'Bonded Tokens': wallet.bondedTokens,
      'Win Rate (%)': wallet.winRate.toFixed(2),
      'Win Rate Score': wallet.scores.winRateScore.toFixed(2),
      'Avg ATH MCap': wallet.avgAthMcap !== null ? wallet.avgAthMcap : 'N/A',
      'Avg ATH MCap Score': wallet.scores.avgAthMcapScore.toFixed(2),
      'Median ATH MCap': wallet.medianAthMcap !== null ? wallet.medianAthMcap : 'N/A',
      'Median ATH MCap Score': wallet.scores.medianAthMcapScore.toFixed(2),
      'ATH MCap Percentile Rank': wallet.athMcapPercentileRank !== null ? wallet.athMcapPercentileRank.toFixed(1) : 'N/A',
      '25th Percentile': wallet.athMcapPercentiles.percentile25th ? 'Yes' : 'No',
      '50th Percentile': wallet.athMcapPercentiles.percentile50th ? 'Yes' : 'No',
      '75th Percentile': wallet.athMcapPercentiles.percentile75th ? 'Yes' : 'No',
      '90th Percentile': wallet.athMcapPercentiles.percentile90th ? 'Yes' : 'No',
      'Avg Buy Count': wallet.buySellStats.avgBuyCount.toFixed(2),
      'Avg Buy Total SOL': wallet.buySellStats.avgBuyTotalSol.toFixed(4),
      'Avg Sell Count': wallet.buySellStats.avgSellCount.toFixed(2),
      'Avg Sell Total SOL': wallet.buySellStats.avgSellTotalSol.toFixed(4),
      'Expected ROI 1st Buy': wallet.expectedROI.avgRoi1stBuy.toFixed(2),
      'Expected ROI 2nd Buy': wallet.expectedROI.avgRoi2ndBuy.toFixed(2),
      'Expected ROI 3rd Buy': wallet.expectedROI.avgRoi3rdBuy.toFixed(2),
      'Avg Rug Rate (%)': wallet.avgRugRate.toFixed(2),
      'Avg Rug Rate Score': wallet.scores.avgRugRateScore.toFixed(2),
      'Avg Rug Time (seconds)': wallet.avgRugTime !== null ? wallet.avgRugTime.toFixed(2) : 'N/A',
      'Time Bucket Rug Rate Score': wallet.scores.timeBucketRugRateScore.toFixed(2),
      'Multiplier Score': wallet.scores.multiplierScore.toFixed(2),
      'Final Score': wallet.scores.finalScore.toFixed(2),
      ...(showWhatIfColumn.value && wallet.whatIfPnl ? {
        'What If Avg PNL': wallet.whatIfPnl.avgPnl.toFixed(2),
        'What If Avg PNL %': wallet.whatIfPnl.avgPnlPercent.toFixed(2),
        'What If Tokens Simulated': wallet.whatIfPnl.tokensSimulated
      } : {}),
      ...Object.entries(wallet.multiplierPercentages).reduce((acc, [multiplier, percentage]) => {
        acc[`${multiplier}x Multiplier %`] = percentage.toFixed(2)
        return acc
      }, {} as Record<string, string>),
      ...Object.entries(wallet.scores.individualMultiplierScores).reduce((acc, [multiplier, score]) => {
        acc[`${multiplier}x Multiplier Score`] = score.toFixed(2)
        return acc
      }, {} as Record<string, string>)
    }))
    
    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Creator Wallets')
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `creator-wallets-${timestamp}.xlsx`
    
    // Write file
    XLSX.writeFile(wb, filename)
  } catch (err: any) {
    console.error('Error exporting data:', err)
    error.value = err.message || 'Failed to export data'
  }
}

onMounted(async () => {
  loadFilterPresets()
  await loadScoringSettings()
  await loadWallets()
})

// Expose method to clear data
const clearData = () => {
  wallets.value = []
  pagination.value = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  }
}

defineExpose({
  clearData
})
</script>

<style scoped>
table {
  border-collapse: collapse;
  border-spacing: 0;
}

th, td {
  border: 1px solid rgb(55, 65, 81); /* border-gray-700 */
}
</style>

