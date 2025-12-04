<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Header -->
    <header class="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-10">
      <div class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              SolTrack
            </h1>
            <p class="text-gray-400 text-xs mt-0.5">Creator Wallet & Token Analytics</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="toggleTracking"
              :disabled="wallets.length === 0"
              :class="[
                'px-4 py-2 text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2',
                isTracking
                  ? 'bg-red-600/90 hover:bg-red-600 text-white focus:ring-red-500/50'
                  : 'bg-green-600/90 hover:bg-green-600 text-white focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed'
              ]"
            >
              <span v-if="isTracking">Stop Tracking</span>
              <span v-else>Start Tracking</span>
            </button>
            <button
              @click="handleLogout"
              class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div class="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Wallets</h3>
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
          </div>
          <p class="text-2xl font-bold text-purple-400">{{ wallets.length }}</p>
          <p class="text-xs text-gray-500 mt-0.5">Active</p>
        </div>
        
        <div class="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Tokens</h3>
            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p class="text-2xl font-bold text-blue-400">0</p>
          <p class="text-xs text-gray-500 mt-0.5">Unique</p>
        </div>
        
        <div class="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Value</h3>
            <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <p class="text-2xl font-bold text-green-400">$0</p>
          <p class="text-xs text-gray-500 mt-0.5">Portfolio</p>
        </div>
        
        <div class="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 border border-cyan-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Txns</h3>
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <p class="text-2xl font-bold text-cyan-400">0</p>
          <p class="text-xs text-gray-500 mt-0.5">24h</p>
        </div>
      </div>

      <!-- Main Dashboard Content -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <!-- Wallets Section -->
        <div class="lg:col-span-2 space-y-3">
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4 backdrop-blur-sm">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-base font-bold text-gray-100">Tracked Creator Wallets</h2>
                <p class="text-gray-500 text-xs mt-0.5">Monitor wallet activity</p>
              </div>
              <button 
                @click="showAddDialog = true"
                class="px-3 py-1.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-xs font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition"
              >
                + Add
              </button>
            </div>
            
            <!-- Search Box -->
            <div v-if="wallets.length > 0" class="mb-3">
              <div class="relative">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search wallet addresses..."
                  class="w-full px-3 py-2 pl-9 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm font-mono"
                />
                <SearchIcon class="text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <button
                  v-if="searchQuery"
                  @click="searchQuery = ''"
                  class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            
            <!-- Wallet List with Scroll Area -->
            <div v-if="filteredWallets.length > 0" class="max-h-96 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              <div 
                v-for="wallet in filteredWallets" 
                :key="wallet"
                class="flex items-center gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-purple-500/50 transition"
              >
                <button
                  @click="copyWalletAddress(wallet)"
                  class="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-900/20 rounded transition flex-shrink-0"
                  :title="copiedAddress === wallet ? 'Copied!' : 'Copy address'"
                >
                  <CheckIcon v-if="copiedAddress === wallet" class="text-green-400" />
                  <CopyIcon v-else />
                </button>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-mono text-gray-300 break-all">{{ wallet }}</p>
                </div>
                <button
                  @click="removeWalletByAddress(wallet)"
                  class="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition flex-shrink-0"
                  title="Remove wallet"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            
            <!-- Empty State (No wallets) -->
            <div v-else-if="wallets.length === 0" class="text-center py-8 border border-dashed border-gray-800 rounded-lg bg-gray-950/50">
              <svg class="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <p class="text-gray-400 text-sm font-semibold mb-1">No wallets tracked</p>
              <p class="text-gray-500 text-xs">Add creator wallets to start tracking</p>
            </div>
            
            <!-- Empty State (No search results) -->
            <div v-else class="text-center py-8 border border-dashed border-gray-800 rounded-lg bg-gray-950/50">
              <svg class="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <p class="text-gray-400 text-sm font-semibold mb-1">No wallets found</p>
              <p class="text-gray-500 text-xs">Try adjusting your search query</p>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-4 backdrop-blur-sm">
            <div class="mb-3">
              <h2 class="text-base font-bold text-gray-100">Recent Token Activity</h2>
              <p class="text-gray-500 text-xs mt-0.5">Latest transactions</p>
            </div>
            <div class="text-center py-6 text-gray-400 text-sm">
              <svg class="w-8 h-8 mx-auto mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              <p class="text-xs">No recent activity</p>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-3">
          <!-- Quick Actions -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-3 backdrop-blur-sm">
            <h2 class="text-sm font-bold text-gray-100 mb-3">Quick Actions</h2>
            <div class="space-y-2">
              <button class="w-full px-3 py-2 bg-gray-800/80 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 text-gray-200 rounded-lg transition text-left flex items-center text-xs font-semibold group">
                <svg class="w-4 h-4 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                Analyze Wallet
              </button>
              <button class="w-full px-3 py-2 bg-gray-800/80 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 text-gray-200 rounded-lg transition text-left flex items-center text-xs font-semibold group">
                <svg class="w-4 h-4 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                View Analytics
              </button>
              <button class="w-full px-3 py-2 bg-gray-800/80 hover:bg-gray-800 border border-gray-700 hover:border-green-500/50 text-gray-200 rounded-lg transition text-left flex items-center text-xs font-semibold group">
                <svg class="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
                Export Data
              </button>
            </div>
          </div>

          <!-- Token Insights -->
          <div class="bg-gray-900/80 border border-gray-800 rounded-lg p-3 backdrop-blur-sm">
            <h2 class="text-sm font-bold text-gray-100 mb-3">Token Insights</h2>
            <div class="space-y-2">
              <div class="p-2.5 bg-gray-800/80 rounded-lg border border-gray-700">
                <p class="text-xs text-gray-400 mb-1">Top Token</p>
                <p class="text-gray-200 font-bold text-sm">-</p>
              </div>
              <div class="p-2.5 bg-gray-800/80 rounded-lg border border-gray-700">
                <p class="text-xs text-gray-400 mb-1">Price Change (24h)</p>
                <p class="text-gray-200 font-bold text-sm">-</p>
              </div>
              <div class="p-2.5 bg-gray-800/80 rounded-lg border border-gray-700">
                <p class="text-xs text-gray-400 mb-1">Volume (24h)</p>
                <p class="text-gray-200 font-bold text-sm">-</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Add Wallet Dialog -->
    <div 
      v-if="showAddDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="closeDialog"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Add Wallet Address</h3>
          <button
            @click="closeDialog"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
        
        <form @submit.prevent="handleAddWallet" class="space-y-4">
          <div>
            <label for="walletAddress" class="block text-xs font-semibold text-gray-300 mb-1.5">
              Wallet Address
            </label>
            <input
              ref="walletAddressInputRef"
              id="walletAddress"
              v-model="walletAddressInput"
              type="text"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm font-mono"
              placeholder="Enter Solana wallet address"
              :disabled="addingWallet"
            />
            <p v-if="walletError" class="mt-1.5 text-xs text-red-400">{{ walletError }}</p>
            <p class="mt-1.5 text-xs text-gray-500">Must be a valid Solana wallet address (not a token or program address)</p>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="closeDialog"
              class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
              :disabled="addingWallet"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="addingWallet || !walletAddressInput.trim()"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="addingWallet">Adding...</span>
              <span v-else>Add Wallet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '../services/auth'
import { validateWallet, getCreatorWallets, addCreatorWallet, removeCreatorWallet } from '../services/wallets'
import { startStream, stopStream, getStreamStatus } from '../services/stream'
import CopyIcon from '../icons/CopyIcon.vue'
import CheckIcon from '../icons/CheckIcon.vue'
import TrashIcon from '../icons/TrashIcon.vue'
import SearchIcon from '../icons/SearchIcon.vue'
import CloseIcon from '../icons/CloseIcon.vue'

const router = useRouter()

const wallets = ref<string[]>([])
const isTracking = ref(false)
const showAddDialog = ref(false)
const walletAddressInput = ref('')
const walletAddressInputRef = ref<HTMLInputElement | null>(null)
const walletError = ref('')
const addingWallet = ref(false)
const searchQuery = ref('')
const copiedAddress = ref<string | null>(null)

// Filter wallets based on search query
const filteredWallets = computed(() => {
  if (!searchQuery.value.trim()) {
    return wallets.value
  }
  const query = searchQuery.value.toLowerCase().trim()
  return wallets.value.filter(wallet => 
    wallet.toLowerCase().includes(query)
  )
})

const handleAddWallet = async () => {
  walletError.value = ''
  const address = walletAddressInput.value.trim()
  
  if (!address) {
    walletError.value = 'Wallet address is required'
    return
  }
  
  // Check for duplicates
  if (wallets.value.includes(address)) {
    walletError.value = 'This wallet address is already added'
    return
  }
  
  addingWallet.value = true
  
  try {
    // Validate via backend API
    const validation = await validateWallet(address)
    
    if (!validation.valid) {
      walletError.value = validation.error || 'Invalid wallet address'
      addingWallet.value = false
      return
    }
    
    // Save wallet to database
    const result = await addCreatorWallet(address)
    
    if (!result.success) {
      walletError.value = result.error || 'Failed to save wallet address'
      addingWallet.value = false
      return
    }
    
    // Add wallet to local state (prepend to show newest first)
    wallets.value.unshift(address)
    walletAddressInput.value = ''
    addingWallet.value = false
    closeDialog()
  } catch (error) {
    walletError.value = 'Error adding wallet address. Please try again.'
    addingWallet.value = false
  }
}

const copyWalletAddress = async (address: string) => {
  try {
    await navigator.clipboard.writeText(address)
    copiedAddress.value = address
    
    // Reset the copied indicator after 2 seconds
    setTimeout(() => {
      copiedAddress.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy address:', error)
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = address
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      
      copiedAddress.value = address
      setTimeout(() => {
        copiedAddress.value = null
      }, 2000)
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError)
      alert('Failed to copy address. Please copy manually.')
    }
  }
}

const removeWalletByAddress = async (address: string) => {
  try {
    // Remove wallet from database
    const result = await removeCreatorWallet(address)
    
    if (!result.success) {
      alert(result.error || 'Failed to remove wallet address')
      return
    }
    
    // Remove wallet from local state
    const index = wallets.value.indexOf(address)
    if (index > -1) {
      wallets.value.splice(index, 1)
    }
    
    // Stop tracking if no wallets left
    if (wallets.value.length === 0) {
      isTracking.value = false
    }
  } catch (error) {
    console.error('Error removing wallet:', error)
    alert('Error removing wallet address. Please try again.')
  }
}

const toggleTracking = async () => {
  if (wallets.value.length === 0) {
    return
  }

  try {
    if (isTracking.value) {
      // Stop streaming
      await stopStream()
      isTracking.value = false
    } else {
      // Start streaming
      await startStream()
      isTracking.value = true
    }
  } catch (error: any) {
    console.error('Error toggling stream:', error)
    alert(error.message || 'Failed to toggle streaming')
  }
}

// Load wallets and check stream status on mount
onMounted(async () => {
  try {
    // Load creator wallets from database
    const savedWallets = await getCreatorWallets()
    wallets.value = savedWallets
    
    // Check stream status
    const response = await getStreamStatus()
    isTracking.value = response.status || false
  } catch (error) {
    console.error('Error loading data:', error)
  }
})

// Stop stream on unmount
onUnmounted(async () => {
  if (isTracking.value) {
    try {
      await stopStream()
    } catch (error) {
      console.error('Error stopping stream on unmount:', error)
}
  }
})

const closeDialog = () => {
  showAddDialog.value = false
  walletAddressInput.value = ''
  walletError.value = ''
}

// Auto-focus input when dialog opens
watch(showAddDialog, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    walletAddressInputRef.value?.focus()
  }
})

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.5);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.7);
}

/* Firefox */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.5) rgba(31, 41, 55, 0.5);
}
</style>

