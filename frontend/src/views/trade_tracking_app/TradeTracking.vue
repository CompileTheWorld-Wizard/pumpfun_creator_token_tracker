<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <!-- Main Content -->
    <main class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <!-- Control Panel -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-4">
        <!-- Status Badge -->
        <div class="mb-4">
          <div 
            :class="[
              'inline-block px-3 py-1 rounded-full text-sm font-semibold',
              isTracking ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            ]"
          >
            {{ isTracking ? '🟢 Running' : '⚫ Stopped' }}
          </div>
        </div>

        <!-- Tracking Addresses Section -->
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-gray-300 mb-2">📍 Tracking Addresses</h3>
          <div class="flex gap-2 mb-2">
            <input
              v-model="newAddress"
              @keyup.enter="addAddress"
              type="text"
              placeholder="Enter Solana address..."
              class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              @click="addAddress"
              class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded font-semibold text-sm hover:from-blue-500 hover:to-blue-600 transition"
            >
              ➕ Add
            </button>
          </div>
          <!-- Address List -->
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(address, index) in addresses"
              :key="index"
              class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm font-mono text-gray-200 flex items-center gap-2"
            >
              <span>{{ address.substring(0, 8) }}...{{ address.substring(address.length - 6) }}</span>
              <button
                @click="removeAddress(index)"
                class="text-red-400 hover:text-red-300 text-xs"
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <!-- Start/Stop Buttons -->
        <div class="flex gap-2">
          <button
            @click="handleStartTracking"
            :disabled="isTracking || addresses.length === 0"
            class="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-semibold text-sm hover:from-green-500 hover:to-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶️ Start Tracking
          </button>
          <button
            @click="handleStopTracking"
            :disabled="!isTracking"
            class="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded font-semibold text-sm hover:from-red-500 hover:to-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏹️ Stop Tracking
          </button>
        </div>
      </div>

      <!-- Skip Tokens Configuration -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-4">
        <div 
          @click="skipTokensExpanded = !skipTokensExpanded"
          class="flex justify-between items-center cursor-pointer mb-2"
        >
          <h3 class="text-sm font-semibold text-gray-300">🚫 Skip Tokens (For Analysis)</h3>
          <span class="text-gray-400">{{ skipTokensExpanded ? '▼' : '▶' }}</span>
        </div>
        <div v-show="skipTokensExpanded" class="mt-3">
          <p class="text-xs text-gray-500 mb-3">
            Tokens in this list will be skipped when analyzing dev buy amounts. Add common tokens like SOL, USDC, USDT, etc.
          </p>
          <div class="flex gap-2 mb-2">
            <input
              v-model="newSkipTokenMint"
              type="text"
              placeholder="Token mint address..."
              class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              v-model="newSkipTokenSymbol"
              type="text"
              placeholder="Symbol (optional)"
              class="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              @click="addSkipToken"
              class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded font-semibold text-sm hover:from-blue-500 hover:to-blue-600 transition"
            >
              ➕ Add
            </button>
          </div>
          <!-- Skip Tokens List -->
          <div class="flex flex-wrap gap-2">
            <div
              v-for="token in skipTokens"
              :key="token.mint_address"
              class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 flex items-center gap-2"
            >
              <span>{{ token.symbol || token.mint_address.substring(0, 8) }}...</span>
              <button
                @click="removeSkipToken(token.mint_address)"
                class="text-red-400 hover:text-red-300 text-xs"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <div class="flex border-b border-gray-800 mb-4">
          <button
            @click="activeTab = 'dashboard'"
            :class="[
              'px-4 py-2 text-sm font-semibold transition',
              activeTab === 'dashboard' 
                ? 'border-b-2 border-blue-500 text-blue-400' 
                : 'text-gray-400 hover:text-gray-200'
            ]"
          >
            📊 Dashboard
          </button>
          <button
            @click="activeTab = 'transactions'"
            :class="[
              'px-4 py-2 text-sm font-semibold transition',
              activeTab === 'transactions' 
                ? 'border-b-2 border-blue-500 text-blue-400' 
                : 'text-gray-400 hover:text-gray-200'
            ]"
          >
            📊 Recent Transactions
          </button>
        </div>

        <!-- Dashboard Tab -->
        <div v-show="activeTab === 'dashboard'" class="space-y-4">
          <DashboardTab 
            :wallet-address="selectedWallet"
            @wallet-selected="selectedWallet = $event"
          />
        </div>

        <!-- Transactions Tab -->
        <div v-show="activeTab === 'transactions'" class="space-y-4">
          <TransactionsTab />
        </div>

      </div>
    </main>

    <!-- Password Change Modal -->
    <PasswordChangeModal 
      v-if="showPasswordModal"
      @close="showPasswordModal = false"
    />

    <!-- Sticky Action Buttons (Bottom Right) - Icon-only with hover expansion -->
    <div class="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      <!-- SOL Price Display -->
      <div class="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg">
        <span class="text-blue-400 font-semibold">SOL</span>
        <span id="solPriceValue" class="text-green-400 font-semibold">{{ solPrice || '--' }}</span>
        <span class="text-gray-500 text-xs">USD</span>
      </div>
      
      <!-- Header Stats -->
      <div class="px-4 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg">
        <span class="text-sm text-gray-200">{{ totalTransactions || 0 }} / {{ trackedAddresses || 0 }}</span>
      </div>
      
      <div class="group relative">
        <button
          @click="showPasswordModal = true"
          class="w-12 h-12 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500/50 flex items-center justify-center shadow-lg"
          title="Change Password"
        >
          <span class="w-5 h-5 inline-flex items-center justify-center" v-html="processSvg(changePasswordIconSvg)"></span>
        </button>
        <span class="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-800 text-gray-200 text-xs font-semibold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-lg">
          Change Password
        </span>
      </div>
      
      <div class="group relative">
        <button
          @click="handleLogout"
          class="w-12 h-12 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500/50 flex items-center justify-center shadow-lg"
          title="Logout"
        >
          <span class="w-5 h-5 inline-flex items-center justify-center" v-html="processSvg(logoutIconSvg)"></span>
        </button>
        <span class="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-red-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-lg">
          Logout
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  fetchTrackingStatus, 
  setAddresses, 
  startTracking, 
  stopTracking,
  fetchSkipTokens,
  addSkipToken as addSkipTokenAPI,
  removeSkipToken as removeSkipTokenAPI,
  fetchSolPrice
} from '../../services/tradeTracking'
import { logout } from '../../services/auth'
import DashboardTab from './DashboardTab.vue'
import TransactionsTab from './TransactionsTab.vue'
import PasswordChangeModal from './PasswordChangeModal.vue'
// Import SVG files as raw strings
import changePasswordIconSvg from '../../icons/change-password.svg?raw'
import logoutIconSvg from '../../icons/logout.svg?raw'

const router = useRouter()

const addresses = ref<string[]>([])
const newAddress = ref('')
const isTracking = ref(false)
const totalTransactions = ref(0)
const trackedAddresses = ref(0)
const solPrice = ref<string | null>(null)
const skipTokens = ref<any[]>([])
const newSkipTokenMint = ref('')
const newSkipTokenSymbol = ref('')
const skipTokensExpanded = ref(false)
const activeTab = ref('dashboard')
const selectedWallet = ref('')
const showPasswordModal = ref(false)

let statusInterval: NodeJS.Timeout | null = null
let solPriceInterval: NodeJS.Timeout | null = null

const loadStatus = async () => {
  const result = await fetchTrackingStatus()
  if (result.success) {
    isTracking.value = result.data.isRunning || false
    addresses.value = result.data.addresses || []
    trackedAddresses.value = addresses.value.length
    totalTransactions.value = result.data.totalTransactions || 0
  }
}

const loadSkipTokens = async () => {
  const result = await fetchSkipTokens()
  if (result.success) {
    skipTokens.value = result.data || []
  }
}

const updateSolPrice = async () => {
  const result = await fetchSolPrice()
  if (result.success && result.price !== null) {
    solPrice.value = parseFloat(result.price.toString()).toFixed(2)
  }
}

const addAddress = () => {
  const address = newAddress.value.trim()
  if (!address) return
  
  if (address.length < 32 || address.length > 44) {
    alert('Invalid Solana address format')
    return
  }
  
  if (addresses.value.includes(address)) {
    alert('Address already added')
    return
  }
  
  if (addresses.value.length >= 5) {
    alert('Maximum 5 addresses allowed')
    return
  }
  
  addresses.value.push(address)
  newAddress.value = ''
}

const removeAddress = (index: number) => {
  addresses.value.splice(index, 1)
}

const handleStartTracking = async () => {
  if (addresses.value.length === 0) {
    alert('Please add at least one address')
    return
  }
  
  // Set addresses first
  const setResult = await setAddresses(addresses.value)
  if (!setResult.success) {
    alert('Failed to set addresses: ' + setResult.error)
    return
  }
  
  // Start tracking
  const startResult = await startTracking()
  if (startResult.success) {
    isTracking.value = true
    await loadStatus()
  } else {
    alert('Failed to start tracking: ' + startResult.error)
  }
}

const handleStopTracking = async () => {
  const result = await stopTracking()
  if (result.success) {
    isTracking.value = false
    await loadStatus()
  } else {
    alert('Failed to stop tracking: ' + result.error)
  }
}

const addSkipToken = async () => {
  const mint = newSkipTokenMint.value.trim()
  if (!mint) return
  
  const result = await addSkipTokenAPI(mint, newSkipTokenSymbol.value.trim() || undefined)
  if (result.success) {
    await loadSkipTokens()
    newSkipTokenMint.value = ''
    newSkipTokenSymbol.value = ''
  } else {
    alert('Failed to add skip token: ' + result.error)
  }
}

const removeSkipToken = async (mintAddress: string) => {
  const result = await removeSkipTokenAPI(mintAddress)
  if (result.success) {
    await loadSkipTokens()
  } else {
    alert('Failed to remove skip token: ' + result.error)
  }
}

onMounted(async () => {
  await Promise.all([loadStatus(), loadSkipTokens(), updateSolPrice()])
  
  // Update status every 10 seconds
  statusInterval = setInterval(loadStatus, 10000)
  
  // Update SOL price every 7 seconds
  solPriceInterval = setInterval(updateSolPrice, 7000)
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  if (solPriceInterval) clearInterval(solPriceInterval)
})

const processSvg = (svg: string, sizeClass: string = 'w-4 h-4') => {
  return svg.replace(
    '<svg',
    `<svg class="${sizeClass}" style="display: block;"`
  )
}

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>
