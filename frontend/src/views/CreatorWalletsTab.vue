<template>
  <div class="w-full">
    <!-- Filter Section -->
    <div class="mb-3 flex items-center gap-3 flex-wrap">
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
                    ${{ formatCurrency(wallet.avgAthMcap) }}<span v-if="viewMode === 'score'" class="text-gray-500 ml-1">({{ wallet.scores.avgAthMcapScore.toFixed(0) }})</span>
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
                  <span v-if="wallet.athMcapPercentiles?.percentile25th" class="text-green-400">✓</span>
                  <span v-else class="text-gray-500">-</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentiles?.percentile50th" class="text-green-400">✓</span>
                  <span v-else class="text-gray-500">-</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentiles?.percentile75th" class="text-green-400">✓</span>
                  <span v-else class="text-gray-500">-</span>
                </div>
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap text-center border border-gray-700">
                <div class="text-xs font-semibold">
                  <span v-if="wallet.athMcapPercentiles?.percentile90th" class="text-green-400">✓</span>
                  <span v-else class="text-gray-500">-</span>
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
                    {{ wallet.buySellStats.avgBuyTotalSol.toFixed(2) }} SOL
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
                    {{ wallet.buySellStats.avgSellTotalSol.toFixed(2) }} SOL
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCreatorWalletsAnalytics, type CreatorWallet, type PaginationInfo } from '../services/creatorWallets'
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
    const response = await getCreatorWalletsAnalytics(
      pagination.value.page,
      limit,
      false // viewAll - can be made configurable later
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

