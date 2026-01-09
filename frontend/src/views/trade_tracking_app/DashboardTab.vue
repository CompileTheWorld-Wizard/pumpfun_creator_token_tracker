<template>
  <div>
    <!-- Wallet Selector -->
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1; font-size: 0.9rem;">
        Select Wallet
      </label>
      <div style="display: flex; gap: 10px; align-items: center; width: 100%; flex-wrap: wrap;">
        <select
          v-model="selectedWallet"
          @change="loadDashboardData"
          style="flex: 1; min-width: 200px; padding: 10px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.85rem; height: 42px; box-sizing: border-box; font-family: 'Courier New', monospace;"
        >
          <option value="">-- Select a wallet --</option>
          <option v-for="wallet in wallets" :key="wallet" :value="wallet">
            {{ wallet }}
          </option>
        </select>
        <button
          @click="loadDashboardData"
          class="btn-refresh"
          style="padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; height: 42px; box-sizing: border-box; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
          title="Refresh Dashboard Data"
        >
          <span>🔄</span> Refresh
        </button>
        <button
          v-if="selectedWallet"
          @click="exportDashboard"
          style="padding: 10px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; height: 42px; box-sizing: border-box; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
          title="Export Dashboard Data to Excel"
        >
          <span>📥</span> Export
        </button>
        <button
          v-if="selectedWallet"
          @click="exportAllWallets"
          style="padding: 10px 20px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; height: 42px; box-sizing: border-box; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
          title="Export All Wallets Data to Excel"
        >
          <span>📥</span> Export All
        </button>
        <button
          v-if="selectedWallet"
          @click="removeWallet"
          style="padding: 10px 20px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; height: 42px; box-sizing: border-box; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);"
          title="Remove wallet and all transactions from database"
        >
          <span>🗑️</span> Remove
        </button>
      </div>
    </div>

    <!-- Wallet Statistics Section -->
    <div v-if="selectedWallet && statistics" class="card" style="margin-bottom: 20px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div class="section-title" style="color: #3b82f6; margin-bottom: 0;">📊 Wallet Statistics</div>
        <div v-if="walletSolBalance !== null" style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.85rem; color: #94a3b8;">Wallet SOL Balance:</span>
          <span style="font-size: 1.2rem; font-weight: 600; color: #3b82f6;">{{ formatNumber(walletSolBalance) }}</span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Total Wallet PNL SOL</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.totalWalletPNL) }}</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Cumulative PNL %</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.cumulativePNL) }}%</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Risk/Reward Profit %</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.riskRewardProfit) }}%</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Net Invested</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.netInvested) }}</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Wallet Average Buy Size in SOL</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.walletAvgBuySize) }}</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Dev Average Buy Size in SOL</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.devAvgBuySize) }}</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Average PNL per Token</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.avgPNLPerToken) }}%</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Total Buys</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ statistics.totalBuys || 0 }}</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Total Sells</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ statistics.totalSells || 0 }}</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Total Average of Open Position</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.averageOpenPosition) }}</div>
        </div>
      </div>
    </div>

    <!-- Dashboard Table -->
    <div v-if="selectedWallet">
      <div v-if="loading" style="text-align: center; padding: 40px; color: #94a3b8;">
        Loading dashboard data...
      </div>
      <div v-else-if="dashboardData.length === 0" style="text-align: center; padding: 40px; color: #94a3b8;">
        No data available for this wallet
      </div>
      <div v-else class="table-container" style="overflow-x: auto; overflow-y: auto; max-height: 70vh; border: 1px solid #334155; position: relative;">
        <table style="width: 100%; border-collapse: collapse; background: #0f1419;">
          <thead style="position: sticky; top: 0; z-index: 10; background: #0f1419;">
            <tr>
              <th style="padding: 10px; text-align: left; font-weight: 600; color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155;">Token</th>
              <th style="padding: 10px; text-align: left; font-weight: 600; color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155;">PNL SOL</th>
              <th style="padding: 10px; text-align: left; font-weight: 600; color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155;">PNL %</th>
              <th style="padding: 10px; text-align: left; font-weight: 600; color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155;">Buy Amount</th>
              <th style="padding: 10px; text-align: left; font-weight: 600; color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155;">Sells</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in dashboardData"
              :key="index"
              style="border-bottom: 1px solid #2d3748;"
              @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#0f1419'; }"
              @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = 'transparent'; }"
            >
              <td style="padding: 10px; border-bottom: 1px solid #2d3748; font-size: 0.75rem; color: #e0e7ff; font-family: 'Courier New', monospace;">{{ item.tokenAddress?.substring(0, 8) }}...{{ item.tokenAddress?.substring(item.tokenAddress.length - 6) }}</td>
              <td style="padding: 10px; border-bottom: 1px solid #2d3748; font-size: 0.75rem; color: #e0e7ff;" :style="{ color: item.pnlSOL >= 0 ? '#10b981' : '#ef4444' }">
                {{ formatNumber(item.pnlSOL) }}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #2d3748; font-size: 0.75rem; color: #e0e7ff;" :style="{ color: item.pnlPercent >= 0 ? '#10b981' : '#ef4444' }">
                {{ formatNumber(item.pnlPercent) }}%
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #2d3748; font-size: 0.75rem; color: #e0e7ff;">{{ formatNumber(item.walletBuyAmountSOL) }} SOL</td>
              <td style="padding: 10px; border-bottom: 1px solid #2d3748; font-size: 0.75rem; color: #e0e7ff;">{{ item.sells?.length || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else style="text-align: center; padding: 40px; color: #94a3b8;">
      Select a wallet to load dashboard data
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #1a1f2e;
  border: 1px solid #2d3748;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(16, 185, 129, 0.05);
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #10b981;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 3px;
  height: 18px;
  background: #10b981;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #1a1f2e;
}

.btn-refresh:hover {
  opacity: 0.9;
}

button:hover {
  opacity: 0.9;
}
</style>

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
const walletSolBalance = ref<number | null>(null)

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
