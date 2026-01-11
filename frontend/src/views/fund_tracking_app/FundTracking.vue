<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <!-- Main Content -->
    <main class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <!-- Control Panel -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-4">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">💰 SOL Transfer Tracking</h2>
        
        <!-- Status Badge -->
        <div class="mb-4">
          <div 
            :class="[
              'inline-block px-3 py-1.5 rounded-full text-sm font-semibold',
              isTracking ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            ]"
          >
            {{ isTracking ? '🟢 Tracking Active' : '⚫ Tracking Stopped' }}
          </div>
        </div>

        <!-- Minimum SOL Amount Configuration -->
        <div class="mb-4">
          <label class="block text-sm font-semibold text-gray-300 mb-2">
            Minimum SOL Amount to Track
          </label>
          <div class="flex gap-2">
            <input
              v-model.number="minSolAmount"
              type="number"
              min="0"
              step="0.1"
              placeholder="10"
              class="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
            <button
              @click="updateMinSolAmountHandler"
              :disabled="isUpdatingMinAmount"
              class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded font-semibold text-sm hover:from-blue-500 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isUpdatingMinAmount ? 'Updating...' : 'Update' }}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Only transfers with amount >= {{ minSolAmount }} SOL will be tracked
          </p>
        </div>

        <!-- Start/Stop Buttons -->
        <div class="flex gap-2">
          <button
            @click="handleStartTracking"
            :disabled="isTracking || isStarting"
            class="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-semibold text-sm hover:from-green-500 hover:to-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isStarting ? 'Starting...' : '▶️ Start Tracking' }}
          </button>
          <button
            @click="handleStopTracking"
            :disabled="!isTracking || isStopping"
            class="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded font-semibold text-sm hover:from-red-500 hover:to-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isStopping ? 'Stopping...' : '⏹️ Stop Tracking' }}
          </button>
          <button
            @click="refreshData"
            :disabled="isLoading"
            class="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded font-semibold text-sm hover:from-gray-500 hover:to-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading ? 'Loading...' : '🔄 Refresh' }}
          </button>
        </div>
      </div>

      <!-- Statistics -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-4">
        <h3 class="text-sm font-semibold text-gray-300 mb-2">Statistics</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-800/50 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Total Transfers</div>
            <div class="text-lg font-bold text-gray-100">{{ totalTransfers }}</div>
          </div>
          <div class="bg-gray-800/50 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Current Page</div>
            <div class="text-lg font-bold text-gray-100">{{ currentPage }} / {{ totalPages }}</div>
          </div>
          <div class="bg-gray-800/50 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Minimum SOL</div>
            <div class="text-lg font-bold text-gray-100">{{ minSolAmount }} SOL</div>
          </div>
        </div>
      </div>

      <!-- Transfers Table -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-semibold text-gray-300">Tracked Transfers</h3>
          <div class="flex gap-2 items-center">
            <label class="text-xs text-gray-400">Per page:</label>
            <select
              v-model.number="pageSize"
              @change="handlePageSizeChange"
              class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
            </select>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading && transfers.length === 0" class="text-center py-8">
          <div class="text-gray-400">Loading transfers...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-8">
          <div class="text-red-400 mb-2">{{ error }}</div>
          <button
            @click="refreshData"
            class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
          >
            Retry
          </button>
        </div>

        <!-- Table -->
        <div v-else-if="transfers.length > 0" class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="text-left py-2 px-2 text-gray-400 font-semibold">Signature</th>
                <th class="text-left py-2 px-2 text-gray-400 font-semibold">Sender</th>
                <th class="text-left py-2 px-2 text-gray-400 font-semibold">Receiver</th>
                <th class="text-right py-2 px-2 text-gray-400 font-semibold">Amount (SOL)</th>
                <th class="text-right py-2 px-2 text-gray-400 font-semibold">Block Number</th>
                <th class="text-left py-2 px-2 text-gray-400 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="transfer in transfers"
                :key="transfer.id"
                class="border-b border-gray-800 hover:bg-gray-800/30 transition"
              >
                <td class="py-2 px-2 font-mono text-gray-300">
                  <a
                    :href="`https://solscan.io/tx/${transfer.signature}`"
                    target="_blank"
                    class="text-blue-400 hover:text-blue-300 hover:underline"
                    :title="transfer.signature"
                  >
                    {{ transfer.signature.substring(0, 16) }}...
                  </a>
                </td>
                <td class="py-2 px-2 font-mono text-gray-300">
                  <a
                    :href="`https://solscan.io/account/${transfer.sender}`"
                    target="_blank"
                    class="text-blue-400 hover:text-blue-300 hover:underline"
                    :title="transfer.sender"
                  >
                    {{ transfer.sender.substring(0, 8) }}...{{ transfer.sender.substring(transfer.sender.length - 6) }}
                  </a>
                </td>
                <td class="py-2 px-2 font-mono text-gray-300">
                  <a
                    :href="`https://solscan.io/account/${transfer.receiver}`"
                    target="_blank"
                    class="text-blue-400 hover:text-blue-300 hover:underline"
                    :title="transfer.receiver"
                  >
                    {{ transfer.receiver.substring(0, 8) }}...{{ transfer.receiver.substring(transfer.receiver.length - 6) }}
                  </a>
                </td>
                <td class="py-2 px-2 text-right font-semibold text-green-400">
                  {{ formatNumber(transfer.amount) }}
                </td>
                <td class="py-2 px-2 text-right text-gray-300">
                  {{ formatNumber(transfer.block_number) }}
                </td>
                <td class="py-2 px-2 text-gray-400">
                  {{ formatDate(transfer.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-800">
            <div class="text-xs text-gray-400">
              Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalTransfers) }} of {{ totalTransfers }} transfers
            </div>
            <div class="flex gap-2">
              <button
                @click="goToPage(currentPage - 1)"
                :disabled="currentPage === 1 || isLoading"
                class="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span class="px-3 py-1 text-gray-300 text-xs">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <button
                @click="goToPage(currentPage + 1)"
                :disabled="currentPage === totalPages || isLoading"
                class="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-8">
          <div class="text-gray-400">No transfers found</div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  fetchTrackingStatus,
  startTracking,
  stopTracking,
  updateMinSolAmount as updateMinSolAmountAPI,
  fetchSolTransfers,
  type SolTransfer
} from '../../services/fundTracking'

const isTracking = ref(false)
const minSolAmount = ref(10)
const transfers = ref<SolTransfer[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const isStarting = ref(false)
const isStopping = ref(false)
const isUpdatingMinAmount = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const totalTransfers = ref(0)

const totalPages = computed(() => {
  return Math.ceil(totalTransfers.value / pageSize.value)
})

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 9
  }).format(num)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadTrackingStatus = async () => {
  try {
    const result = await fetchTrackingStatus()
    if (result.success && result.data) {
      isTracking.value = result.data.isTracking
      minSolAmount.value = result.data.minSolAmount
    } else {
      error.value = result.error || 'Failed to load tracking status'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load tracking status'
  }
}

const loadTransfers = async () => {
  isLoading.value = true
  error.value = null
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const result = await fetchSolTransfers(pageSize.value, offset)
    if (result.success && result.transfers) {
      transfers.value = result.transfers
      // Estimate total based on current page and results
      if (result.transfers.length === pageSize.value) {
        totalTransfers.value = Math.max(totalTransfers.value, currentPage.value * pageSize.value)
      } else {
        totalTransfers.value = (currentPage.value - 1) * pageSize.value + result.transfers.length
      }
    } else {
      error.value = result.error || 'Failed to load transfers'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load transfers'
  } finally {
    isLoading.value = false
  }
}

const handleStartTracking = async () => {
  isStarting.value = true
  error.value = null
  try {
    const result = await startTracking()
    if (result.success) {
      isTracking.value = true
      await loadTransfers()
    } else {
      error.value = result.error || 'Failed to start tracking'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to start tracking'
  } finally {
    isStarting.value = false
  }
}

const handleStopTracking = async () => {
  isStopping.value = true
  error.value = null
  try {
    const result = await stopTracking()
    if (result.success) {
      isTracking.value = false
    } else {
      error.value = result.error || 'Failed to stop tracking'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to stop tracking'
  } finally {
    isStopping.value = false
  }
}

const updateMinSolAmountHandler = async () => {
  if (minSolAmount.value < 0) {
    error.value = 'Minimum SOL amount must be >= 0'
    return
  }

  isUpdatingMinAmount.value = true
  error.value = null
  try {
    const result = await updateMinSolAmountAPI(minSolAmount.value)
    if (result.success) {
      if (result.minSolAmount !== undefined) {
        minSolAmount.value = result.minSolAmount
      }
    } else {
      error.value = result.error || 'Failed to update minimum SOL amount'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to update minimum SOL amount'
  } finally {
    isUpdatingMinAmount.value = false
  }
}

const refreshData = async () => {
  await Promise.all([loadTrackingStatus(), loadTransfers()])
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    loadTransfers()
  }
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  loadTransfers()
}

// Auto-refresh every 30 seconds when tracking is active
let refreshInterval: number | null = null

onMounted(async () => {
  await refreshData()
  
  refreshInterval = window.setInterval(() => {
    if (isTracking.value) {
      loadTransfers()
    }
    loadTrackingStatus()
  }, 30000)
})

// Cleanup interval on unmount
onUnmounted(() => {
  if (refreshInterval !== null) {
    clearInterval(refreshInterval)
  }
})
</script>
