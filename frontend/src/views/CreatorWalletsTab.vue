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
            <div v-if="filters.totalTokens.min !== undefined || filters.totalTokens.max !== undefined || Object.keys(filters.totalTokens).length > 0" class="inline-flex items-center gap-2 px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg">
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
            <div v-if="filters.bondedTokens.min !== undefined || filters.bondedTokens.max !== undefined || Object.keys(filters.bondedTokens).length > 0" class="inline-flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
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

            <!-- Win Rate Filter Widget -->
            <div v-if="filters.winRate.type" class="inline-flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-500/30 rounded-lg">
              <span class="text-xs font-semibold text-green-300">Win Rate ({{ filters.winRate.type === 'percent' ? '%' : 'Score' }}):</span>
              <template v-if="filters.winRate.type === 'percent'">
                <input
                  v-model.number="filters.winRate.percentMin"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Min %"
                  class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
                />
                <span class="text-xs text-gray-400">to</span>
                <input
                  v-model.number="filters.winRate.percentMax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Max %"
                  class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
                />
              </template>
              <template v-else>
                <input
                  v-model.number="filters.winRate.scoreMin"
                  type="number"
                  step="0.1"
                  placeholder="Min Score"
                  class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
                />
                <span class="text-xs text-gray-400">to</span>
                <input
                  v-model.number="filters.winRate.scoreMax"
                  type="number"
                  step="0.1"
                  placeholder="Max Score"
                  class="px-2 py-1 text-xs bg-gray-900/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
                />
              </template>
              <button
                @click="removeFilter('winRate')"
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
          <!-- Filter Type Selection (Tree) -->
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-2">Select Filter Type:</label>
            <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
              <!-- Token Count Group -->
              <div class="mb-2">
                <div 
                  @click="expandedGroups.tokenCount = !expandedGroups.tokenCount"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.tokenCount }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Token Count
                </div>
                <div v-if="expandedGroups.tokenCount" class="ml-4 space-y-1">
                  <div
                    v-if="!isFilterAdded('totalTokens')"
                    @click="selectFilterType('totalTokens')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'totalTokens' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Total Tokens
                  </div>
                  <div
                    v-if="!isFilterAdded('bondedTokens')"
                    @click="selectFilterType('bondedTokens')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'bondedTokens' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Bonded Tokens
                  </div>
                </div>
              </div>

              <!-- Win Rate Group -->
              <div class="mb-2">
                <div 
                  @click="expandedGroups.winRate = !expandedGroups.winRate"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.winRate }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Win Rate
                </div>
                <div v-if="expandedGroups.winRate" class="ml-4 space-y-1">
                  <div
                    v-if="!isFilterAdded('winRatePercent') && !isFilterAdded('winRateScore')"
                    @click="selectFilterType('winRatePercent')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'winRatePercent' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Win Rate (Percentage)
                  </div>
                  <div
                    v-if="!isFilterAdded('winRatePercent') && !isFilterAdded('winRateScore')"
                    @click="selectFilterType('winRateScore')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'winRateScore' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Win Rate (Score)
                  </div>
                </div>
              </div>

              <!-- Average Market Cap Group -->
              <div>
                <div 
                  @click="expandedGroups.avgMcap = !expandedGroups.avgMcap"
                  class="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1 cursor-pointer hover:text-gray-300"
                >
                  <svg 
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedGroups.avgMcap }"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                  Average Market Cap
                </div>
                <div v-if="expandedGroups.avgMcap" class="ml-4 space-y-1">
                  <div
                    v-if="!isAvgMcapFilterAdded('mcap')"
                    @click="selectFilterType('avgMcapAmount')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'avgMcapAmount' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Average MCap (Amount)
                  </div>
                  <div
                    v-if="!isAvgMcapFilterAdded('percentile')"
                    @click="selectFilterType('avgMcapPercentile')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'avgMcapPercentile' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Average MCap (Percentile)
                  </div>
                  <div
                    v-if="!isAvgMcapFilterAdded('score')"
                    @click="selectFilterType('avgMcapScore')"
                    :class="[
                      'px-2 py-1.5 text-xs rounded cursor-pointer transition',
                      newFilterType === 'avgMcapScore' 
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                        : 'text-gray-300 hover:bg-gray-700/50'
                    ]"
                  >
                    Average MCap (Score)
                  </div>
                </div>
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
              :disabled="!newFilterType"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Filter
            </button>
          </div>
        </div>
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
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Total Tokens(Valid)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Bonded Tokens</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Win Rate (% Bonded)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg ATH MCap</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Median ATH MCap</th>
              <th colspan="4" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">ATH MCap Percentiles</th>
              <th colspan="4" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Buys/Sells</th>
              <th colspan="3" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Expected ROI (1st/2nd/3rd Buy)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Rug Rate (%)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider border border-gray-700">Avg Rug Time (seconds)</th>
              <th rowspan="2" class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[280px] border border-gray-700">Multiplier Scores</th>
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
              <td colspan="20" class="px-2 py-8 text-center">
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
              <td class="px-2 py-1.5 whitespace-nowrap text-right border border-gray-700">
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
              <td class="px-2 py-1.5 text-right border border-gray-700">
                <div v-if="wallet.avgRugTime !== null && wallet.avgRugTime !== undefined">
                  <div class="text-xs font-semibold" :class="wallet.avgRugTime <= 5 ? 'text-red-400' : wallet.avgRugTime <= 15 ? 'text-yellow-400' : 'text-green-400'">
                    {{ wallet.avgRugTime.toFixed(2) }}s<span v-if="viewMode === 'score'" class="text-gray-500 ml-1">({{ wallet.scores.timeBucketRugRateScore?.toFixed(0) || '0' }})</span>
                  </div>
                </div>
                <div v-else class="text-xs text-gray-500">N/A</div>
              </td>
              <td class="px-2 py-1.5 text-right min-w-[280px] border border-gray-700">
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

// Tree expansion state
const expandedGroups = ref({
  tokenCount: true,
  winRate: false,
  avgMcap: false
})

// New filter configuration state
const newFilterConfig = ref({
  totalTokens: { min: undefined as number | undefined, max: undefined as number | undefined },
  bondedTokens: { min: undefined as number | undefined, max: undefined as number | undefined },
  winRatePercent: { min: undefined as number | undefined, max: undefined as number | undefined },
  winRateScore: { min: undefined as number | undefined, max: undefined as number | undefined },
  avgMcapAmount: { min: undefined as number | undefined, max: undefined as number | undefined },
  avgMcapPercentile: { min: undefined as number | undefined, max: undefined as number | undefined },
  avgMcapScore: { min: undefined as number | undefined, max: undefined as number | undefined }
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
  winRate: {
    type: 'percent' | 'score' | ''
    percentMin?: number
    percentMax?: number
    scoreMin?: number
    scoreMax?: number
  }
  avgMcap: Array<{
    type: 'mcap' | 'percentile' | 'score'
    min?: number
    max?: number
  }>
}

const filters = ref<Filters>({
  totalTokens: {},
  bondedTokens: {},
  winRate: { type: '' },
  avgMcap: []
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

// Check if a filter is already added
const isFilterAdded = (filterType: string): boolean => {
  switch (filterType) {
    case 'totalTokens':
      return filters.value.totalTokens.min !== undefined || filters.value.totalTokens.max !== undefined
    case 'bondedTokens':
      return filters.value.bondedTokens.min !== undefined || filters.value.bondedTokens.max !== undefined
    case 'winRatePercent':
    case 'winRateScore':
      return filters.value.winRate.type !== ''
    default:
      return false
  }
}

// Check if an avg mcap filter type is already added
const isAvgMcapFilterAdded = (filterType: 'mcap' | 'percentile' | 'score'): boolean => {
  return filters.value.avgMcap.some(f => f.type === filterType)
}

// Confirm adding filter from dialog
const confirmAddFilter = () => {
  if (!newFilterType.value) return

  switch (newFilterType.value) {
    case 'totalTokens':
      filters.value.totalTokens = {
        min: undefined,
        max: undefined
      }
      break
    case 'bondedTokens':
      filters.value.bondedTokens = {
        min: undefined,
        max: undefined
      }
      break
    case 'winRatePercent':
      filters.value.winRate = {
        type: 'percent',
        percentMin: undefined,
        percentMax: undefined
      }
      break
    case 'winRateScore':
      filters.value.winRate = {
        type: 'score',
        scoreMin: undefined,
        scoreMax: undefined
      }
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
  }

  cancelAddFilter()
}

// Cancel adding filter
const cancelAddFilter = () => {
  showAddFilterDialog.value = false
  newFilterType.value = ''
  // Reset all config values
  newFilterConfig.value = {
    totalTokens: { min: undefined, max: undefined },
    bondedTokens: { min: undefined, max: undefined },
    winRatePercent: { min: undefined, max: undefined },
    winRateScore: { min: undefined, max: undefined },
    avgMcapAmount: { min: undefined, max: undefined },
    avgMcapPercentile: { min: undefined, max: undefined },
    avgMcapScore: { min: undefined, max: undefined }
  }
  // Reset tree expansion
  expandedGroups.value = {
    tokenCount: true,
    winRate: false,
    avgMcap: false
  }
}

// Remove a specific filter
const removeFilter = (filterType: 'totalTokens' | 'bondedTokens' | 'winRate') => {
  switch (filterType) {
    case 'totalTokens':
      filters.value.totalTokens = {}
      break
    case 'bondedTokens':
      filters.value.bondedTokens = {}
      break
    case 'winRate':
      filters.value.winRate = { type: '' }
      break
  }
}

// Remove average market cap filter
const removeAvgMcapFilter = (index: number) => {
  filters.value.avgMcap.splice(index, 1)
}

// Clear all filters
const clearFilters = () => {
  filters.value = {
    totalTokens: {},
    bondedTokens: {},
    winRate: { type: '' },
    avgMcap: []
  }
  selectedFilterPreset.value = ''
  applyFilters()
}

// Check if filters are active
const hasActiveFilters = computed(() => {
  return !!(
    Object.keys(filters.value.totalTokens).length > 0 ||
    Object.keys(filters.value.bondedTokens).length > 0 ||
    filters.value.winRate.type ||
    filters.value.avgMcap.length > 0
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (Object.keys(filters.value.totalTokens).length > 0) count++
  if (Object.keys(filters.value.bondedTokens).length > 0) count++
  if (filters.value.winRate.type) count++
  count += filters.value.avgMcap.length
  return count
})

// Load filter preset
const loadFilterPreset = () => {
  if (!selectedFilterPreset.value) return
  const preset = filterPresets.value.find(p => p.id === selectedFilterPreset.value)
  if (preset) {
    filters.value = JSON.parse(JSON.stringify(preset.filters))
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

// Apply filters
const applyFilters = () => {
  pagination.value.page = 1
  loadWallets()
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
      filterParams.totalTokens = {
        min: filters.value.totalTokens.min,
        max: filters.value.totalTokens.max
      }
    }
    
    if (filters.value.bondedTokens.min !== undefined || filters.value.bondedTokens.max !== undefined) {
      filterParams.bondedTokens = {
        min: filters.value.bondedTokens.min,
        max: filters.value.bondedTokens.max
      }
    }
    
    if (filters.value.winRate.type) {
      filterParams.winRate = {
        type: filters.value.winRate.type,
        percentMin: filters.value.winRate.percentMin,
        percentMax: filters.value.winRate.percentMax,
        scoreMin: filters.value.winRate.scoreMin,
        scoreMax: filters.value.winRate.scoreMax
      }
    }
    
    if (filters.value.avgMcap.length > 0) {
      filterParams.avgMcap = filters.value.avgMcap
    }
    
    const response = await getCreatorWalletsAnalytics(
      pagination.value.page,
      limit,
      false, // viewAll - can be made configurable later
      filterParams
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

