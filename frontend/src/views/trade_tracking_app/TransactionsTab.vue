<template>
  <div class="space-y-4">
    <!-- Wallet Filter -->
    <div class="mb-4">
      <label class="block text-sm font-semibold text-gray-300 mb-2">Filter by Wallet</label>
      <div class="flex gap-2">
        <select
          v-model="selectedWallet"
          @change="loadTransactions"
          class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Wallets</option>
          <option v-for="wallet in wallets" :key="wallet" :value="wallet">
            {{ wallet.substring(0, 8) }}...{{ wallet.substring(wallet.length - 6) }}
          </option>
        </select>
        <button
          @click="loadTransactions"
          class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded font-semibold text-sm hover:from-blue-500 hover:to-blue-600 transition"
        >
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Transactions Table -->
    <div class="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading transactions...
      </div>
      <div v-else-if="transactions.length === 0" class="text-center py-8 text-gray-400">
        No transactions found
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-800">
            <tr>
              <th class="px-3 py-2 text-left border-b border-gray-700">Transaction ID</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Platform</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Type</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Mint From</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Mint To</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">In Amount</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Out Amount</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Fee Payer</th>
              <th class="px-3 py-2 text-left border-b border-gray-700">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(tx, index) in transactions"
              :key="index"
              class="border-b border-gray-800 hover:bg-gray-800/50"
            >
              <td class="px-3 py-2 font-mono text-xs">{{ tx.transaction_id?.substring(0, 8) }}...</td>
              <td class="px-3 py-2">{{ tx.platform }}</td>
              <td class="px-3 py-2">
                <span :class="tx.type?.toLowerCase() === 'buy' ? 'text-green-400' : 'text-red-400'">
                  {{ tx.type }}
                </span>
              </td>
              <td class="px-3 py-2 font-mono text-xs">{{ tx.mint_from?.substring(0, 8) }}...</td>
              <td class="px-3 py-2 font-mono text-xs">{{ tx.mint_to?.substring(0, 8) }}...</td>
              <td class="px-3 py-2">{{ formatAmount(tx.in_amount) }}</td>
              <td class="px-3 py-2">{{ formatAmount(tx.out_amount) }}</td>
              <td class="px-3 py-2 font-mono text-xs">{{ tx.feePayer?.substring(0, 8) }}...</td>
              <td class="px-3 py-2 text-xs">{{ formatTime(tx.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center items-center gap-4">
      <button
        @click="previousPage"
        :disabled="currentPage === 1"
        class="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ← Previous
      </button>
      <span class="text-gray-400 text-sm">Page {{ currentPage }} of {{ totalPages }}</span>
      <button
        @click="nextPage"
        :disabled="currentPage === totalPages"
        class="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchTransactions, fetchAllWallets } from '../../services/tradeTracking'

const selectedWallet = ref('')
const wallets = ref<string[]>([])
const transactions = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const totalPages = ref(1)

const formatAmount = (amount: string | number | null | undefined): string => {
  if (!amount) return '-'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(num) ? '-' : num.toLocaleString()
}

const formatTime = (time: string | null | undefined): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

const loadTransactions = async () => {
  loading.value = true
  try {
    const walletFilter = selectedWallet.value ? [selectedWallet.value] : []
    const result = await fetchTransactions(currentPage.value, pageSize.value, walletFilter)
    
    if (result.success) {
      transactions.value = result.data.transactions || []
      const total = result.data.total || 0
      totalPages.value = Math.ceil(total / pageSize.value)
    }
  } catch (error) {
    console.error('Failed to load transactions:', error)
  } finally {
    loading.value = false
  }
}

const loadWallets = async () => {
  const result = await fetchAllWallets()
  if (result.success) {
    wallets.value = result.wallets || []
  }
}

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTransactions()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadTransactions()
  }
}

onMounted(async () => {
  await loadWallets()
  await loadTransactions()
})
</script>
