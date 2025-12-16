<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Header -->
    <header class="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
      <div class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Created Tokens
            </h1>
            <p class="text-gray-400 text-xs mt-0.5">15-Second Market Cap Analytics</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="$router.push('/board')"
              class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
            >
              ← Back to Dashboard
            </button>
            <button
              @click="handleLogout"
              class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <!-- Filter Section -->
      <div class="mb-3 flex items-center gap-3 flex-wrap">
        <label class="text-xs text-gray-400 font-medium">Filter by Creator Wallet:</label>
        <select
          v-model="selectedCreatorWallet"
          @change="handleFilterChange"
          class="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 min-w-[250px]"
        >
          <option value="">All Wallets</option>
          <option v-for="wallet in creatorWallets" :key="wallet" :value="wallet">
            {{ formatWalletAddress(wallet) }}
          </option>
        </select>
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
        <span class="text-xs text-gray-500">
          {{ pagination.total }} token{{ pagination.total !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Error State -->
      <div v-if="error" class="bg-red-900/20 border border-red-500/30 rounded p-2 mb-3">
        <p class="text-red-400 text-xs">{{ error }}</p>
      </div>

      <!-- Tokens Table -->
      <div class="bg-gray-900/80 border border-gray-800 rounded overflow-hidden flex flex-col">
        <div class="overflow-x-auto overflow-y-auto relative" style="max-height: calc(100vh - 280px);">
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
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Token</th>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Initial MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Peak MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Final MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ATH MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Trades</th>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Created</th>
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
                @click="selectedToken = token"
              >
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <button
                      @click.stop="copyToClipboard(token.mint)"
                      class="p-0.5 hover:bg-gray-700 rounded transition flex-shrink-0"
                      :class="copiedToken === token.mint ? 'text-green-400' : 'text-gray-400 hover:text-purple-400'"
                      :title="copiedToken === token.mint ? 'Copied!' : 'Copy token address'"
                    >
                      <CheckIcon v-if="copiedToken === token.mint" class="w-3 h-3" />
                      <CopyIcon v-else class="w-3 h-3" />
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
                      <CheckIcon v-if="copiedToken === token.creator" class="w-3 h-3" />
                      <CopyIcon v-else class="w-3 h-3" />
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
                    <canvas :ref="el => setChartRef(token.mint, el)" class="w-full h-full"></canvas>
                  </div>
                  <div v-else class="w-16 h-8 flex items-center justify-center">
                    <span class="text-[10px] text-gray-600">No data</span>
                  </div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-center">
                  <button
                    @click.stop="selectedToken = token"
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
          </div>
        </div>
      </div>
    </main>

    <!-- Token Detail Modal -->
    <div
      v-if="selectedToken"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="selectedToken = null"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-100">{{ selectedToken.name || 'Unnamed Token' }}</h2>
            <p class="text-sm text-gray-500 font-mono mt-1">{{ selectedToken.mint }}</p>
          </div>
          <button
            @click="selectedToken = null"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Token Info -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">Symbol</p>
            <p class="text-lg font-bold text-gray-200">{{ selectedToken.symbol }}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">Status</p>
            <p class="text-lg font-bold" :class="selectedToken.bonded ? 'text-green-400' : 'text-yellow-400'">
              {{ selectedToken.bonded ? 'Bonded' : 'Bonding Curve' }}
            </p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">Trades (15s)</p>
            <p class="text-lg font-bold text-gray-200">{{ selectedToken.tradeCount15s }}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">ATH Market Cap</p>
            <p class="text-lg font-bold text-green-400">
              ${{ formatCurrency(selectedToken.athMarketCapUsd) }}
            </p>
          </div>
        </div>

        <!-- Market Cap Stats -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Initial Market Cap</p>
            <p class="text-2xl font-bold text-blue-400">
              ${{ formatCurrency(selectedToken.initialMarketCapUsd) }}
            </p>
          </div>
          <div class="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Peak Market Cap</p>
            <p class="text-2xl font-bold text-green-400">
              ${{ formatCurrency(selectedToken.peakMarketCapUsd) }}
            </p>
          </div>
          <div class="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Final Market Cap</p>
            <p class="text-2xl font-bold text-purple-400">
              ${{ formatCurrency(selectedToken.finalMarketCapUsd) }}
            </p>
          </div>
        </div>

        <!-- Market Cap Chart -->
        <div v-if="selectedToken.marketCapTimeSeries && selectedToken.marketCapTimeSeries.length > 0" class="mb-6">
          <h3 class="text-lg font-bold text-gray-100 mb-4">Market Cap Time Series (First 15 Seconds)</h3>
          <div class="bg-gray-800/30 rounded-lg p-4">
            <canvas ref="detailChartRef" class="w-full" style="height: 300px;"></canvas>
          </div>
        </div>
        <div v-else class="mb-6">
          <div class="bg-gray-800/30 rounded-lg p-8 text-center">
            <p class="text-gray-500 text-sm">No market cap data available</p>
          </div>
        </div>

        <!-- Transaction Link -->
        <div class="flex justify-end">
          <a
            :href="`https://gmgn.ai/sol/token/${selectedToken.mint}`"
            target="_blank"
            rel="noopener noreferrer"
            class="px-4 py-2 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
          >
            View in Gmgn →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '../services/auth'
import { getCreatedTokens, type Token, type PaginationInfo } from '../services/tokens'
import { getCreatorWallets } from '../services/wallets'
import CopyIcon from '../icons/CopyIcon.vue'
import CheckIcon from '../icons/CheckIcon.vue'

const router = useRouter()

const tokens = ref<Token[]>([])
const creatorWallets = ref<string[]>([])
const selectedCreatorWallet = ref<string>('')
const loading = ref(true)
const error = ref<string | null>(null)
const selectedToken = ref<Token | null>(null)
const chartRefs = ref<Map<string, HTMLCanvasElement>>(new Map())
const detailChartRef = ref<HTMLCanvasElement | null>(null)
const copiedToken = ref<string | null>(null)
const itemsPerPage = ref<number | string>(20)
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, pagination.value.page - Math.floor(maxVisible / 2))
  let end = Math.min(pagination.value.totalPages, start + maxVisible - 1)
  
  // Adjust start if we're near the end
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const goToPage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    pagination.value.page = page
    loadTokens()
  }
}

const handleFilterChange = () => {
  pagination.value.page = 1
  loadTokens()
}

const handleItemsPerPageChange = () => {
  pagination.value.page = 1
  if (itemsPerPage.value === 'all') {
    pagination.value.limit = 1000000 // Very large number to get all items
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

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedToken.value = text
    setTimeout(() => {
      copiedToken.value = null
    }, 1000)
  } catch (err) {
    console.error('Failed to copy:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      copiedToken.value = text
      setTimeout(() => {
        copiedToken.value = null
      }, 1000)
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr)
    }
    document.body.removeChild(textArea)
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

const drawDetailChart = (canvas: HTMLCanvasElement, timeSeries: any[]) => {
  if (!timeSeries || timeSeries.length === 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width = canvas.offsetWidth
  const height = canvas.height = 300
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }

  ctx.clearRect(0, 0, width, height)

  const values = timeSeries.map(d => d.marketCapUsd)
  const min = Math.min(...values) * 0.95
  const max = Math.max(...values) * 1.05
  const range = max - min || 1

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Draw grid lines
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (i / 5) * chartHeight
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  // Draw chart line
  ctx.strokeStyle = '#a855f7'
  ctx.lineWidth = 3
  ctx.beginPath()

  timeSeries.forEach((point, index) => {
    const x = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
    const y = padding.top + chartHeight - ((point.marketCapUsd - min) / range) * chartHeight
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()

  // Draw points
  ctx.fillStyle = '#a855f7'
  timeSeries.forEach((point, index) => {
    const x = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
    const y = padding.top + chartHeight - ((point.marketCapUsd - min) / range) * chartHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  // Draw labels
  ctx.fillStyle = '#9ca3af'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'right'
  
  // Y-axis labels
  for (let i = 0; i <= 5; i++) {
    const value = min + (max - min) * (1 - i / 5)
    const y = padding.top + (i / 5) * chartHeight
    ctx.fillText(formatCurrency(value), padding.left - 10, y + 4)
  }

  // X-axis labels
  ctx.textAlign = 'center'
  const timeLabels = timeSeries.map((_, i) => {
    const time = timeSeries[i].timestamp - timeSeries[0].timestamp
    return `${(time / 1000).toFixed(1)}s`
  })
  
  timeSeries.forEach((_, index) => {
    if (index % Math.ceil(timeSeries.length / 5) === 0 || index === timeSeries.length - 1) {
      const x = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
      ctx.fillText(timeLabels[index], x, height - padding.bottom + 20)
    }
  })

  // Title
  ctx.fillStyle = '#f3f4f6'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Market Cap (USD)', width / 2, 15)
}

// Watch for selected token changes to draw detail chart
watch(selectedToken, async (newToken) => {
  if (newToken && detailChartRef.value) {
    await nextTick()
    if (newToken.marketCapTimeSeries && newToken.marketCapTimeSeries.length > 0) {
      drawDetailChart(detailChartRef.value, newToken.marketCapTimeSeries)
    }
  }
})

// Draw mini charts after tokens load
watch(tokens, async () => {
  await nextTick()
  tokens.value.forEach(token => {
    const canvas = chartRefs.value.get(token.mint)
    if (canvas && token.marketCapTimeSeries && token.marketCapTimeSeries.length > 0) {
      drawMiniChart(canvas, token.marketCapTimeSeries)
    }
  })
}, { deep: true })

const loadCreatorWallets = async () => {
  try {
    creatorWallets.value = await getCreatorWallets()
  } catch (err: any) {
    console.error('Error loading creator wallets:', err)
  }
}

const loadTokens = async () => {
  loading.value = true
  error.value = null
  
  try {
    const limit = itemsPerPage.value === 'all' ? 1000000 : (itemsPerPage.value as number)
    const response = await getCreatedTokens(
      pagination.value.page,
      limit,
      selectedCreatorWallet.value || undefined
    )
    tokens.value = response.tokens
    pagination.value = response.pagination
  } catch (err: any) {
    error.value = err.message || 'Failed to load tokens'
    console.error('Error loading tokens:', err)
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  await logout()
  router.push('/login')
}

onMounted(async () => {
  await Promise.all([loadCreatorWallets(), loadTokens()])
})
</script>

<style scoped>
/* Custom scrollbar for modal */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.7);
}

/* Table styling */
table {
  border-collapse: separate;
  border-spacing: 0;
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>
