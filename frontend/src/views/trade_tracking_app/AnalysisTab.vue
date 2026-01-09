<template>
  <div class="space-y-4">
    <!-- Wallet Selector -->
    <div class="mb-4">
      <label class="block text-sm font-semibold text-gray-300 mb-2">Select Wallet for Analysis</label>
      <div class="flex gap-2">
        <select
          v-model="selectedWallet"
          @change="loadAnalysis"
          class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a wallet --</option>
          <option v-for="wallet in wallets" :key="wallet" :value="wallet">
            {{ wallet.substring(0, 8) }}...{{ wallet.substring(wallet.length - 6) }}
          </option>
        </select>
        <button
          @click="loadAnalysis"
          class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded font-semibold text-sm hover:from-blue-500 hover:to-blue-600 transition"
        >
          🔄 Refresh
        </button>
        <button
          v-if="selectedWallet"
          @click="exportAll"
          class="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-semibold text-sm hover:from-green-500 hover:to-green-600 transition"
        >
          📥 Export All
        </button>
      </div>
    </div>

    <!-- Analysis Results -->
    <div v-if="selectedWallet && analysisData" class="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading analysis...
      </div>
      <div v-else-if="analysisData.tokens && analysisData.tokens.length > 0" class="space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Total Tokens</div>
            <div class="text-xl font-bold text-gray-100">{{ analysisData.tokens.length }}</div>
          </div>
          <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Total Buys</div>
            <div class="text-xl font-bold text-gray-100">{{ analysisData.totalBuys || 0 }}</div>
          </div>
          <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Total Sells</div>
            <div class="text-xl font-bold text-gray-100">{{ analysisData.totalSells || 0 }}</div>
          </div>
          <div class="bg-gray-800/50 border border-gray-700 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Avg Open Position</div>
            <div class="text-xl font-bold text-gray-100">{{ formatNumber(analysisData.averageOpenPosition) }}</div>
          </div>
        </div>

        <!-- Tokens Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left border-b border-gray-700">Token</th>
                <th class="px-3 py-2 text-left border-b border-gray-700">Symbol</th>
                <th class="px-3 py-2 text-left border-b border-gray-700">Buy Amount</th>
                <th class="px-3 py-2 text-left border-b border-gray-700">Sells</th>
                <th class="px-3 py-2 text-left border-b border-gray-700">PNL</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(token, index) in analysisData.tokens"
                :key="index"
                class="border-b border-gray-800 hover:bg-gray-800/50"
              >
                <td class="px-3 py-2 font-mono text-xs">{{ token.tokenAddress?.substring(0, 8) }}...</td>
                <td class="px-3 py-2">{{ token.symbol || '-' }}</td>
                <td class="px-3 py-2">{{ formatNumber(token.walletBuyAmountSOL) }} SOL</td>
                <td class="px-3 py-2">{{ token.sells?.length || 0 }}</td>
                <td class="px-3 py-2" :class="token.pnlSOL >= 0 ? 'text-green-400' : 'text-red-400'">
                  {{ formatNumber(token.pnlSOL) }} SOL
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="text-center py-8 text-gray-400">
        No analysis data available
      </div>
    </div>
    <div v-else class="text-center py-8 text-gray-400">
      Select a wallet to view analysis
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { analyzeWallet, fetchAllWallets, downloadAllTokensExcel } from '../../services/tradeTracking'

const selectedWallet = ref('')
const wallets = ref<string[]>([])
const analysisData = ref<any>(null)
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

const loadAnalysis = async () => {
  if (!selectedWallet.value) {
    analysisData.value = null
    return
  }
  
  loading.value = true
  try {
    const result = await analyzeWallet(selectedWallet.value, 1, 50)
    if (result.success) {
      analysisData.value = result.data
    }
  } catch (error) {
    console.error('Failed to load analysis:', error)
  } finally {
    loading.value = false
  }
}

const exportAll = async () => {
  if (!selectedWallet.value) return
  await downloadAllTokensExcel(selectedWallet.value)
}

onMounted(async () => {
  await loadWallets()
})
</script>
