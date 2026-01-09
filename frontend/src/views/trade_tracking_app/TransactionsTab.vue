<template>
  <div>
    <!-- Wallet Filter -->
    <div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 250px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1; font-size: 0.9rem;">
          Filter by Wallet
        </label>
        <select
          v-model="selectedWallet"
          @change="loadTransactions"
          style="width: 100%; padding: 10px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.85rem; font-family: 'Courier New', monospace; height: 42px; box-sizing: border-box;"
        >
          <option value="">All Wallets</option>
          <option v-for="wallet in wallets" :key="wallet" :value="wallet">
            {{ wallet }}
          </option>
        </select>
      </div>
      <button
        @click="loadTransactions"
        class="btn-refresh"
        style="padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; height: 42px; box-sizing: border-box; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s; margin-bottom: 0;"
      >
        <span>🔄</span> Refresh
      </button>
    </div>

    <!-- Transactions Table -->
    <div class="table-container">
      <div v-if="loading" class="empty-state">
        <div style="text-align: center; padding: 40px; color: #94a3b8;">
          Loading transactions...
        </div>
      </div>
      <div v-else-if="transactions.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 50px; height: 50px; margin: 0 auto 10px; opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 style="font-size: 1rem; margin-bottom: 5px;">No transactions yet</h3>
        <p style="font-size: 0.8rem;">Start tracking addresses to see transactions appear here</p>
      </div>
      <table v-else id="transactionsTable" style="width: 100%; border-collapse: collapse; background: #1a1f2e;">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Platform</th>
            <th>Type</th>
            <th>Mint From</th>
            <th>Mint To</th>
            <th>In Amount</th>
            <th>Out Amount</th>
            <th>Fee Payer</th>
            <th>Fee+Tip</th>
            <th>Market Cap</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(tx, index) in transactions"
            :key="index"
            @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#0f1419'; }"
            @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = 'transparent'; }"
          >
            <td class="mono" :title="tx.transaction_id">
              <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                <a :href="`https://solscan.io/tx/${tx.transaction_id}`" target="_blank" rel="noopener noreferrer" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #60a5fa; text-decoration: underline;">
                  {{ truncateAddress(tx.transaction_id) }}
                </a>
                <button
                  @click="copyToClipboard(tx.transaction_id)"
                  class="copy-icon-btn"
                  title="Copy address"
                  style="background: transparent; border: none; cursor: pointer; padding: 4px; display: inline-flex; align-items: center; justify-content: center; color: #9ca3af; transition: color 0.2s; margin-left: 6px; flex-shrink: 0;"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </td>
            <td>
              <span :class="`platform-badge ${getPlatformClass(tx.platform)}`">{{ tx.platform }}</span>
            </td>
            <td>{{ tx.type }}</td>
            <td>{{ truncateAddress(tx.mint_from) }}</td>
            <td>{{ truncateAddress(tx.mint_to) }}</td>
            <td>{{ formatAmount(tx.in_amount) }}</td>
            <td>{{ formatAmount(tx.out_amount) }}</td>
            <td class="mono" :title="tx.feePayer">
              <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                <a :href="`https://solscan.io/account/${tx.feePayer}`" target="_blank" rel="noopener noreferrer" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #60a5fa; text-decoration: underline;">
                  {{ truncateAddress(tx.feePayer) }}
                </a>
                <button
                  @click="copyToClipboard(tx.feePayer)"
                  class="copy-icon-btn"
                  title="Copy address"
                  style="background: transparent; border: none; cursor: pointer; padding: 4px; display: inline-flex; align-items: center; justify-content: center; color: #9ca3af; transition: color 0.2s; margin-left: 6px; flex-shrink: 0;"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </td>
            <td style="white-space: nowrap;" v-html="formatFeeTip(tx)"></td>
            <td>{{ formatCurrency(tx.marketCap) }}</td>
            <td>{{ formatTime(tx.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        @click="previousPage"
        :disabled="currentPage === 1"
        style="padding: 6px 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);"
        :style="{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }"
      >
        ← Previous
      </button>
      <span style="color: #cbd5e1; font-weight: 500; font-size: 0.75rem;">Page {{ currentPage }} of {{ totalPages }}</span>
      <button
        @click="nextPage"
        :disabled="currentPage === totalPages"
        style="padding: 6px 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);"
        :style="{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }"
      >
        Next →
      </button>
    </div>
  </div>
</template>

<style scoped>
.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #1a1f2e;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #1a1f2e;
}

thead {
  background: #0f1419;
}

th {
  padding: 10px;
  text-align: left;
  font-weight: 600;
  color: #10b981;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #334155;
}

td {
  padding: 10px;
  border-bottom: 1px solid #2d3748;
  font-size: 0.75rem;
  color: #e0e7ff;
}

tbody tr:last-child td {
  border-bottom: none;
}

.mono {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
}

.platform-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

.platform-raydium { background: #c084fc; color: white; }
.platform-orca { background: #06b6d4; color: white; }
.platform-meteora { background: #f59e0b; color: white; }
.platform-pump { background: #ec4899; color: white; }
.platform-pumpfun { background: #8b5cf6; color: white; }
.platform-unknown { background: #6b7280; color: white; }

.empty-state {
  text-align: center;
  padding: 30px 15px;
  color: #94a3b8;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.copy-icon-btn:hover {
  color: #667eea;
}

a {
  color: #60a5fa;
  text-decoration: underline;
  transition: all 0.2s;
}

a:hover {
  color: #93c5fd;
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.5);
}
</style>

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

const truncateAddress = (address: string | null | undefined, startLength = 8, endLength = 6): string => {
  if (!address || address.length <= startLength + endLength) {
    return address || '-'
  }
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`
}

const formatAmount = (amount: string | number | null | undefined): string => {
  if (!amount) return '-'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(num) ? '-' : num.toLocaleString()
}

const formatTime = (time: string | null | undefined): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

const formatFeeTip = (tx: any): string => {
  const tipAmount = (tx.tipAmount != null ? parseFloat(tx.tipAmount) : tx.tip_amount != null ? parseFloat(tx.tip_amount) : 0) || 0
  const feeAmount = (tx.feeAmount != null ? parseFloat(tx.feeAmount) : tx.fee_amount != null ? parseFloat(tx.fee_amount) : 0) || 0
  
  const formatSOL = (value: number) => {
    if (value === null || value === undefined || value === 0) return '-'
    return value.toFixed(9).replace(/\.?0+$/, '') + ' SOL'
  }
  
  const feeDisplay = formatSOL(feeAmount)
  const tipDisplay = formatSOL(tipAmount)
  
  if (feeDisplay !== '-' || tipDisplay !== '-') {
    return `<div style="line-height: 1.4;">
      <div>Fee: ${feeDisplay}</div>
      <div>Tip: ${tipDisplay}</div>
    </div>`
  }
  return '-'
}

const getPlatformClass = (platform: string | null | undefined): string => {
  if (!platform) return 'platform-unknown'
  const platformLower = platform.toLowerCase()
  if (platformLower.includes('raydium')) return 'platform-raydium'
  if (platformLower.includes('orca')) return 'platform-orca'
  if (platformLower.includes('meteora')) return 'platform-meteora'
  if (platformLower.includes('pump') && !platformLower.includes('fun')) return 'platform-pump'
  if (platformLower.includes('pumpfun')) return 'platform-pumpfun'
  return 'platform-unknown'
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // You could add a notification here
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
    document.body.removeChild(textArea)
  }
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
