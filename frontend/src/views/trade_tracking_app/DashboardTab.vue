<template>
  <div class="space-y-4">
    <!-- Wallet Selector -->
    <div class="mb-4">
      <label class="block text-sm font-semibold text-gray-300 mb-2">Select Wallet</label>
      <div class="flex gap-2">
        <select
          v-model="selectedWallet"
          @change="loadDashboardData"
          class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a wallet --</option>
          <option v-for="wallet in wallets" :key="wallet" :value="wallet">
            {{ wallet.substring(0, 8) }}...{{ wallet.substring(wallet.length - 6) }}
          </option>
        </select>
        <button
          @click="loadDashboardData"
          class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded font-semibold text-sm hover:from-blue-500 hover:to-blue-600 transition"
        >
          🔄 Refresh
        </button>
        <button
          v-if="selectedWallet"
          @click="exportDashboard"
          class="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-semibold text-sm hover:from-green-500 hover:to-green-600 transition"
        >
          📥 Export
        </button>
        <button
          v-if="selectedWallet"
          @click="exportAllWallets"
          class="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded font-semibold text-sm hover:from-purple-500 hover:to-purple-600 transition"
        >
          📥 Export All
        </button>
        <button
          v-if="selectedWallet"
          @click="removeWallet"
          class="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded font-semibold text-sm hover:from-red-500 hover:to-red-600 transition"
        >
          🗑️ Remove
        </button>
      </div>
    </div>

    <!-- Wallet Statistics -->
    <div v-if="selectedWallet && statistics" class="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-blue-400 mb-4">📊 Wallet Statistics</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Total Wallet PNL SOL</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.totalWalletPNL) }}</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Cumulative PNL %</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.cumulativePNL) }}%</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Risk/Reward Profit %</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.riskRewardProfit) }}%</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Net Invested</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.netInvested) }}</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Wallet Avg Buy Size SOL</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.walletAvgBuySize) }}</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Dev Avg Buy Size SOL</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.devAvgBuySize) }}</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Avg PNL per Token</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.avgPNLPerToken) }}%</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Total Buys</div>
          <div class="text-xl font-bold text-gray-100">{{ statistics.totalBuys || 0 }}</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Total Sells</div>
          <div class="text-xl font-bold text-gray-100">{{ statistics.totalSells || 0 }}</div>
        </div>
        <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
          <div class="text-xs text-gray-400 mb-1">Avg Open Position</div>
          <div class="text-xl font-bold text-gray-100">{{ formatNumber(statistics.averageOpenPosition) }}</div>
        </div>
      </div>
    </div>

    <!-- Dashboard Table -->
    <div v-if="selectedWallet" class="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading dashboard data...
      </div>
      <div v-else-if="dashboardData.length === 0" class="text-center py-8 text-gray-400">
        No data available for this wallet
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-800">
            <tr>
              <th class="px-3 py-2 text-left border-b border-gray-700">Token</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">PNL SOL</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">PNL %</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Buy Amount</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Sells</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in dashboardData"
              :key="index"
              class="border-b border-gray-800 hover:bg-gray-800/50"
            >
              <td class="px-3 py-2 font-mono text-xs">{{ item.tokenAddress?.substring(0, 8) }}...</td>
              <td class="px-3 py-2" :class="item.pnlSOL >= 0 ? 'text-green-400' : 'text-red-400'">
                {{ formatNumber(item.pnlSOL) }}
              </td>
              <td class="px-3 py-2" :class="item.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'">
                {{ formatNumber(item.pnlPercent) }}%
              </td>
              <td class="px-3 py-2">{{ formatNumber(item.walletBuyAmountSOL) }} SOL</td>
              <td class="px-3 py-2">{{ item.sells?.length || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="text-center py-8 text-gray-400">
      Select a wallet to load dashboard data
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { 
  fetchAllWallets,
  fetchDashboardStatistics,
  fetchDashboardData,
  downloadAllTokensExcel,
  deleteWalletAndTransactions
} from '../../services/tradeTracking'

const props = defineProps<{
  walletAddress?: string
}>()

const emit = defineEmits<{
  (e: 'wallet-selected', wallet: string): void
}>()

const selectedWallet = ref(props.walletAddress || '')
const wallets = ref<string[]>([])
const statistics = ref<any>(null)
const dashboardData = ref<any[]>([])
const loading = ref(false)

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return typeof value === 'number' ? value.toFixed(2) : String(value)
}

const loadWallets = async () => {
  const result = await fetchAllWallets()
  if (result.success) {
    wallets.value = result.wallets || []
  }
}

const loadDashboardData = async () => {
  if (!selectedWallet.value) {
    statistics.value = null
    dashboardData.value = []
    return
  }
  
  emit('wallet-selected', selectedWallet.value)
  
  loading.value = true
  try {
    const [statsResult, dataResult] = await Promise.all([
      fetchDashboardStatistics(selectedWallet.value),
      fetchDashboardData(selectedWallet.value, 1, 50, [])
    ])
    
    if (statsResult.success) {
      statistics.value = statsResult.statistics
    }
    
    if (dataResult.success) {
      dashboardData.value = dataResult.data || []
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    loading.value = false
  }
}

const exportDashboard = async () => {
  if (!selectedWallet.value) return
  await downloadAllTokensExcel(selectedWallet.value)
}

const exportAllWallets = async () => {
  // Export all wallets - would need to implement this
  alert('Export all wallets feature coming soon')
}

const removeWallet = async () => {
  if (!selectedWallet.value) return
  if (!confirm('Are you sure you want to remove this wallet and all its transactions?')) return
  
  const result = await deleteWalletAndTransactions(selectedWallet.value)
  if (result.success) {
    selectedWallet.value = ''
    await loadWallets()
    await loadDashboardData()
  } else {
    alert('Failed to remove wallet: ' + result.error)
  }
}

watch(() => props.walletAddress, (newVal) => {
  if (newVal) {
    selectedWallet.value = newVal
    loadDashboardData()
  }
})

onMounted(async () => {
  await loadWallets()
  if (selectedWallet.value) {
    await loadDashboardData()
  }
})
</script>
