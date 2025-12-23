<template>
  <div class="w-full">
    <!-- Filter Section -->
    <div class="mb-3 flex items-center gap-3 flex-wrap">
      <label class="text-xs text-gray-400 font-medium">Filter by Creator Wallet:</label>
      <div class="relative min-w-[250px]">
        <div class="relative">
          <input
            v-model="walletInputValue"
            @focus="handleWalletInputFocus"
            @blur="walletInputFocused = false"
            @input="showWalletDropdown = true; highlightedWalletIndex = -1"
            @keydown.escape="showWalletDropdown = false; walletInputFocused = false"
            @keydown.enter.prevent="handleWalletSelect(filteredWalletOptions[highlightedWalletIndex >= 0 ? highlightedWalletIndex : 0]?.value || '')"
            @keydown.down.prevent="navigateWalletDropdown(1)"
            @keydown.up.prevent="navigateWalletDropdown(-1)"
            type="text"
            :placeholder="!selectedCreatorWallet ? 'Search or select wallet...' : ''"
            class="w-full px-2 py-1 pr-8 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            v-if="selectedCreatorWallet"
            @click.stop="clearWalletSelection"
            class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200 transition"
          >
            <span class="w-3 h-3 inline-flex items-center justify-center" v-html="processSvg(closeIconSvg, 'w-3 h-3')"></span>
          </button>
          <div
            v-else
            class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>
        <!-- Dropdown -->
        <div
          v-if="showWalletDropdown && filteredWalletOptions.length > 0"
          class="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          <div
            v-for="(option, index) in filteredWalletOptions"
            :key="option.value"
            :data-index="index"
            @click="handleWalletSelect(option.value)"
            @mouseenter="highlightedWalletIndex = index"
            :class="[
              'px-3 py-2 text-xs cursor-pointer transition',
              highlightedWalletIndex === index ? 'bg-purple-600/30 text-purple-300' : 'text-gray-200 hover:bg-gray-800'
            ]"
          >
            <div v-if="option.value === ''" class="font-semibold text-purple-400">{{ option.label }}</div>
            <div v-else class="font-mono">{{ option.label }}</div>
          </div>
        </div>
      </div>
      <label class="text-xs text-gray-400 font-medium ml-3">Items per page:</label>
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
      <div class="ml-auto flex items-center gap-2">
        <button
          @click="handleExport"
          :disabled="loading || tokens.length === 0"
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
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-900/20 border border-red-500/30 rounded p-2 mb-3">
      <p class="text-red-400 text-xs">{{ error }}</p>
    </div>

    <!-- Tokens Table -->
    <div class="bg-gray-900/80 border border-gray-800 rounded overflow-hidden flex flex-col">
      <div class="overflow-x-auto overflow-y-auto relative" style="max-height: calc(100vh - 350px);">
        <!-- Loading Overlay -->
        <div v-if="loading" class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-0" style="top: 0;">
          <div class="flex items-center gap-2 bg-gray-900/60 backdrop-blur-md px-4 py-3 rounded-lg border border-gray-700/50">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
            <span class="text-xs text-gray-200 font-medium">Loading tokens...</span>
          </div>
        </div>
        <table class="w-full text-xs relative">
          <thead class="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
            <tr>
              <th 
                @click="handleSort('name')"
                class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center gap-1">
                  <span>Token</span>
                  <span v-if="getSortIcon('name')" class="text-purple-400">{{ getSortIcon('name') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('creator')"
                class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center gap-1">
                  <span>Creator</span>
                  <span v-if="getSortIcon('creator')" class="text-purple-400">{{ getSortIcon('creator') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('status')"
                class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center gap-1">
                  <span>Status</span>
                  <span v-if="getSortIcon('status')" class="text-purple-400">{{ getSortIcon('status') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('initialMC')"
                class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center justify-end gap-1">
                  <span>Initial MC</span>
                  <span v-if="getSortIcon('initialMC')" class="text-purple-400">{{ getSortIcon('initialMC') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('peakMC')"
                class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center justify-end gap-1">
                  <span>Peak MC</span>
                  <span v-if="getSortIcon('peakMC')" class="text-purple-400">{{ getSortIcon('peakMC') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('finalMC')"
                class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center justify-end gap-1">
                  <span>Final MC</span>
                  <span v-if="getSortIcon('finalMC')" class="text-purple-400">{{ getSortIcon('finalMC') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('athMC')"
                class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center justify-end gap-1">
                  <span>ATH MC</span>
                  <span v-if="getSortIcon('athMC')" class="text-purple-400">{{ getSortIcon('athMC') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('trades')"
                class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center justify-end gap-1">
                  <span>Trades</span>
                  <span v-if="getSortIcon('trades')" class="text-purple-400">{{ getSortIcon('trades') }}</span>
                </div>
              </th>
              <th 
                @click="handleSort('created')"
                class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition select-none"
              >
                <div class="flex items-center gap-1">
                  <span>Created</span>
                  <span v-if="getSortIcon('created')" class="text-purple-400">{{ getSortIcon('created') }}</span>
                </div>
              </th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chart</th>
              <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <!-- Empty State -->
            <tr v-if="!loading && tokens.length === 0">
              <td :colspan="11" class="px-2 py-8 text-center">
                <p class="text-gray-400 text-xs font-semibold mb-1">
                  {{ selectedCreatorWallet ? 'No tokens found for this wallet' : 'No tokens tracked yet' }}
                </p>
                <p class="text-gray-500 text-[10px]">
                  {{ selectedCreatorWallet ? 'Try selecting a different wallet' : 'Tokens created by tracked wallets will appear here' }}
                </p>
              </td>
            </tr>
            <!-- Token Rows -->
            <tr
              v-for="token in tokens"
              :key="token.mint"
              class="hover:bg-gray-800/50 transition cursor-pointer"
              @click="$emit('select-token', token)"
            >
              <td class="px-2 py-1.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <button
                    @click.stop="copyToClipboard(token.mint)"
                    class="p-0.5 hover:bg-gray-700 rounded transition flex-shrink-0"
                    :class="copiedToken === token.mint ? 'text-green-400' : 'text-gray-400 hover:text-purple-400'"
                    :title="copiedToken === token.mint ? 'Copied!' : 'Copy token address'"
                  >
                    <span class="w-3 h-3 inline-flex items-center justify-center" v-html="processSvg(copiedToken === token.mint ? checkIconSvg : copyIconSvg, 'w-3 h-3')"></span>
                  </button>
                  <div>
                    <div class="text-xs font-semibold text-gray-100">{{ token.name || 'Unnamed Token' }}</div>
                    <div class="text-[10px] text-gray-500 font-mono">{{ formatAddress(token.mint) }}</div>
                  </div>
                  <span class="px-1.5 py-0.5 bg-purple-600/20 text-purple-400 text-[10px] font-semibold rounded">
                    {{ token.symbol }}
                  </span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <button
                    @click.stop="copyToClipboard(token.creator)"
                    class="p-0.5 hover:bg-gray-700 rounded transition flex-shrink-0"
                    :class="copiedToken === token.creator ? 'text-green-400' : 'text-gray-400 hover:text-purple-400'"
                    :title="copiedToken === token.creator ? 'Copied!' : 'Copy creator wallet address'"
                  >
                    <span class="w-3 h-3 inline-flex items-center justify-center" v-html="processSvg(copiedToken === token.creator ? checkIconSvg : copyIconSvg, 'w-3 h-3')"></span>
                  </button>
                  <div class="text-[10px] text-gray-400 font-mono">{{ formatAddress(token.creator) }}</div>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap">
                <span
                  :class="token.bonded ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'"
                  class="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                >
                  {{ token.bonded ? 'Bonded' : 'Bonding' }}
                </span>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right">
                <div class="text-xs font-semibold text-gray-200">${{ formatCurrency(token.initialMarketCapUsd) }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right">
                <div class="text-xs font-semibold text-green-400">${{ formatCurrency(token.peakMarketCapUsd) }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right">
                <div class="text-xs font-semibold text-gray-200">${{ formatCurrency(token.finalMarketCapUsd) }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right">
                <div class="text-xs font-semibold text-green-400">${{ formatCurrency(token.athMarketCapUsd) }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-right">
                <div class="text-xs font-semibold text-gray-200">{{ token.tradeCount15s }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap">
                <div class="text-[10px] text-gray-400">{{ formatDate(token.createdAt) }}</div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap">
                <div v-if="token.marketCapTimeSeries && token.marketCapTimeSeries.length > 0" class="w-16 h-8">
                  <canvas :ref="el => setChartRef(token.mint, el as HTMLCanvasElement | null)" class="w-full h-full"></canvas>
                </div>
                <div v-else class="w-16 h-8 flex items-center justify-center">
                  <span class="text-[10px] text-gray-600">No data</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center">
                <button
                  @click.stop="$emit('select-token', token)"
                  class="px-2 py-1 bg-purple-600/90 hover:bg-purple-600 text-white text-[10px] font-semibold rounded transition"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Controls -->
      <div v-if="pagination.total > 0" class="px-4 py-3 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
        <div class="text-xs text-gray-400">
          <span v-if="itemsPerPage === 'all'">
            Showing all {{ pagination.total }} token{{ pagination.total !== 1 ? 's' : '' }}
          </span>
          <span v-else>
            Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} tokens
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getCreatedTokens, getCreatorWalletsFromTokens, type Token, type PaginationInfo } from '../services/tokens'
import copyIconSvg from '../icons/copy.svg?raw'
import checkIconSvg from '../icons/check.svg?raw'
import closeIconSvg from '../icons/close.svg?raw'
import * as XLSX from 'xlsx'

const emit = defineEmits<{
  'select-token': [token: Token]
  'update-total': [total: number]
  'data-updated': []
}>()

// Helper function to process SVG for inline rendering
const processSvg = (svg: string, sizeClass: string = 'w-4 h-4') => {
  return svg.replace(
    '<svg',
    `<svg class="${sizeClass}" style="display: block;"`
  )
}

const creatorWallets = ref<string[]>([])
const selectedCreatorWallet = ref<string>('')
const walletSearchQuery = ref('')
const showWalletDropdown = ref(false)
const highlightedWalletIndex = ref(-1)
const walletInputFocused = ref(false)

// Computed property for wallet input display value
const walletInputValue = computed({
  get: () => {
    if (walletInputFocused.value || showWalletDropdown.value) {
      return walletSearchQuery.value
    }
    return selectedCreatorWallet.value ? formatWalletAddress(selectedCreatorWallet.value) : walletSearchQuery.value
  },
  set: (value: string) => {
    walletSearchQuery.value = value
  }
})

const tokens = ref<Token[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const chartRefs = ref<Map<string, HTMLCanvasElement>>(new Map())
const copiedToken = ref<string | null>(null)
const itemsPerPage = ref<number | string>(20)
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})
const refreshing = ref(false)

// Sorting state
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('desc')

// Filter wallet options for the Select2-like input
const filteredWalletOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [
    { value: '', label: 'All Wallets' }
  ]
  
  const query = walletSearchQuery.value.toLowerCase().trim()
  
  creatorWallets.value.forEach(address => {
    if (!query || address.toLowerCase().includes(query) || formatWalletAddress(address).toLowerCase().includes(query)) {
      options.push({
        value: address,
        label: formatWalletAddress(address)
      })
    }
  })
  
  return options
})

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

const handleSort = (column: string) => {
  if (sortColumn.value === column) {
    // Toggle direction if clicking the same column
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new column and default to descending
    sortColumn.value = column
    sortDirection.value = 'desc'
  }
  // Reload data with new sort parameters
  pagination.value.page = 1
  loadTokens().then(() => {
    emit('data-updated')
  })
}

const getSortIcon = (column: string) => {
  if (sortColumn.value !== column) {
    return null
  }
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '0'
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K'
  return value.toFixed(2)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const formatAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

const formatWalletAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    pagination.value.page = page
    loadTokens()
  }
}

const handleFilterChange = async () => {
  await loadCreatorWallets()
  pagination.value.page = 1
  await loadTokens()
  emit('data-updated')
}

const handleWalletInputFocus = () => {
  walletInputFocused.value = true
  showWalletDropdown.value = true
  highlightedWalletIndex.value = -1
  if (selectedCreatorWallet.value) {
    walletSearchQuery.value = ''
  }
}

const handleWalletSelect = async (value: string) => {
  selectedCreatorWallet.value = value
  walletSearchQuery.value = ''
  showWalletDropdown.value = false
  walletInputFocused.value = false
  highlightedWalletIndex.value = -1
  await handleFilterChange()
}

const clearWalletSelection = async () => {
  selectedCreatorWallet.value = ''
  walletSearchQuery.value = ''
  showWalletDropdown.value = false
  walletInputFocused.value = false
  highlightedWalletIndex.value = -1
  await handleFilterChange()
}

const navigateWalletDropdown = (direction: number) => {
  if (filteredWalletOptions.value.length === 0) return
  
  highlightedWalletIndex.value += direction
  
  if (highlightedWalletIndex.value < 0) {
    highlightedWalletIndex.value = filteredWalletOptions.value.length - 1
  } else if (highlightedWalletIndex.value >= filteredWalletOptions.value.length) {
    highlightedWalletIndex.value = 0
  }
  
  nextTick(() => {
    const dropdowns = document.querySelectorAll('.absolute.z-50')
    if (dropdowns.length > 0) {
      const dropdown = Array.from(dropdowns).find(el => 
        el.querySelector(`[data-index="${highlightedWalletIndex.value}"]`)
      ) as HTMLElement
      if (dropdown) {
        const highlighted = dropdown.querySelector(`[data-index="${highlightedWalletIndex.value}"]`) as HTMLElement
        if (highlighted) {
          highlighted.scrollIntoView({ block: 'nearest' })
        }
      }
    }
  })
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.relative.min-w-\\[250px\\]')) {
    showWalletDropdown.value = false
    walletInputFocused.value = false
    highlightedWalletIndex.value = -1
    if (selectedCreatorWallet.value) {
      walletSearchQuery.value = ''
    }
  }
}

const handleItemsPerPageChange = () => {
  pagination.value.page = 1
  if (itemsPerPage.value === 'all') {
    pagination.value.limit = 1000000
  } else {
    pagination.value.limit = itemsPerPage.value as number
  }
  loadTokens()
}

const setChartRef = (mint: string, el: HTMLCanvasElement | null) => {
  if (el) {
    chartRefs.value.set(mint, el)
  }
}

const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      copiedToken.value = text
      setTimeout(() => {
        copiedToken.value = null
      }, 1000)
      return
    }
    
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
        copiedToken.value = text
        setTimeout(() => {
          copiedToken.value = null
        }, 1000)
      }
    } finally {
      document.body.removeChild(textArea)
    }
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const drawMiniChart = (canvas: HTMLCanvasElement, timeSeries: any[]) => {
  if (!timeSeries || timeSeries.length === 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width = canvas.offsetWidth
  const height = canvas.height = canvas.offsetHeight
  const padding = 2

  ctx.clearRect(0, 0, width, height)

  const values = timeSeries.map(d => d.marketCapUsd)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  ctx.strokeStyle = '#a855f7'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  timeSeries.forEach((point, index) => {
    const x = padding + (index / (timeSeries.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - ((point.marketCapUsd - min) / range) * (height - padding * 2)
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()
}

const loadCreatorWallets = async () => {
  try {
    creatorWallets.value = await getCreatorWalletsFromTokens(true)
  } catch (err: any) {
    console.error('Error loading creator wallets:', err)
    creatorWallets.value = []
  }
}

const loadTokens = async () => {
  loading.value = true
  error.value = null
  
  try {
    const limit = itemsPerPage.value === 'all' ? 1000000 : (itemsPerPage.value as number)
    const viewAll = !selectedCreatorWallet.value
    const response = await getCreatedTokens(
      pagination.value.page,
      limit,
      selectedCreatorWallet.value || undefined,
      viewAll,
      sortColumn.value,
      sortDirection.value
    )
    tokens.value = response.tokens
    pagination.value = response.pagination
    
    // Emit total count to parent
    emit('update-total', pagination.value.total)
    
    await loadCreatorWallets()
  } catch (err: any) {
    error.value = err.message || 'Failed to load tokens'
    console.error('Error loading tokens:', err)
  } finally {
    loading.value = false
  }
}

const handleExport = async () => {
  try {
    // Fetch all tokens for export
    const limit = 1000000 // Large limit to get all data
    const viewAll = !selectedCreatorWallet.value
    const response = await getCreatedTokens(
      1,
      limit,
      selectedCreatorWallet.value || undefined,
      viewAll
    )
    
    const allTokens = response.tokens
    
    // Prepare data for Excel export
    const exportData = allTokens.map(token => ({
      'Token Name': token.name || 'Unnamed Token',
      'Symbol': token.symbol,
      'Mint Address': token.mint,
      'Creator Wallet': token.creator,
      'Bonding Curve': token.bondingCurve,
      'Status': token.bonded ? 'Bonded' : 'Bonding',
      'Initial Market Cap (USD)': token.initialMarketCapUsd !== null ? token.initialMarketCapUsd : 'N/A',
      'Peak Market Cap (USD)': token.peakMarketCapUsd !== null ? token.peakMarketCapUsd : 'N/A',
      'Final Market Cap (USD)': token.finalMarketCapUsd !== null ? token.finalMarketCapUsd : 'N/A',
      'ATH Market Cap (USD)': token.athMarketCapUsd !== null ? token.athMarketCapUsd : 'N/A',
      'Trade Count (15s)': token.tradeCount15s,
      'Created At': token.createdAt,
      'Create TX Signature': token.createTxSignature,
      'Tracked At': token.trackedAt,
      'Updated At': token.updatedAt
    }))
    
    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tokens')
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `tokens-${timestamp}.xlsx`
    
    // Write file
    XLSX.writeFile(wb, filename)
  } catch (err: any) {
    console.error('Error exporting data:', err)
    error.value = err.message || 'Failed to export data'
  }
}

const handleRefresh = async () => {
  if (refreshing.value) {
    return
  }

  refreshing.value = true
  try {
    await loadTokens()
    emit('data-updated')
  } catch (err: any) {
    console.error('Error refreshing data:', err)
  } finally {
    refreshing.value = false
  }
}

watch(tokens, async () => {
  await nextTick()
  tokens.value.forEach(token => {
    const canvas = chartRefs.value.get(token.mint)
    if (canvas && token.marketCapTimeSeries && token.marketCapTimeSeries.length > 0) {
      drawMiniChart(canvas, token.marketCapTimeSeries)
    }
  })
}, { deep: true })

onMounted(async () => {
  await loadTokens()
  await loadCreatorWallets()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Expose method to clear data
const clearData = () => {
  tokens.value = []
  pagination.value = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  }
  emit('update-total', 0)
}

defineExpose({
  clearData
})
</script>

<style scoped>
table {
  border-collapse: separate;
  border-spacing: 0;
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>

