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
          <span style="font-size: 1.2rem; font-weight: 600; color: #3b82f6;">{{ formatNumber(walletSolBalance) }} SOL</span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Total Wallet PNL SOL</div>
          <div style="font-size: 1.2rem; font-weight: 600;" :style="{ color: (statistics.totalWalletPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ formatNumber(statistics.totalWalletPNL) }} SOL
          </div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Cumulative PNL %</div>
          <div style="font-size: 1.2rem; font-weight: 600;" :style="{ color: (statistics.cumulativePNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ formatNumber(statistics.cumulativePNL) }}%
          </div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Risk/Reward Profit %</div>
          <div style="font-size: 1.2rem; font-weight: 600;" :style="{ color: (statistics.riskRewardProfit || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ formatNumber(statistics.riskRewardProfit) }}%
          </div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Net Invested</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.netInvested) }} SOL</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Wallet Average Buy Size in SOL</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.walletAvgBuySize) }} SOL</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Dev Average Buy Size in SOL</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #e0e7ff;">{{ formatNumber(statistics.devAvgBuySize) }} SOL</div>
        </div>
        <div style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Average PNL per Token</div>
          <div style="font-size: 1.2rem; font-weight: 600;" :style="{ color: (statistics.avgPNLPerToken || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ formatNumber(statistics.avgPNLPerToken) }}%
          </div>
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
        <div
          v-if="selectedWallet"
          @click="openActiveTimeChart"
          style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155; cursor: pointer; transition: all 0.2s;"
          @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.borderColor='#3b82f6'; target.style.background='#1e293b' }"
          @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.borderColor='#334155'; target.style.background='#1a1f2e' }"
          title="View Trading Activity Chart"
        >
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">📊 Active Time</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #3b82f6;">View Chart</div>
        </div>
        <div
          v-if="selectedWallet"
          @click="openPeakPriceChart"
          style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155; cursor: pointer; transition: all 0.2s;"
          @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.borderColor='#3b82f6'; target.style.background='#1e293b' }"
          @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.borderColor='#334155'; target.style.background='#1a1f2e' }"
          title="View Peak Price Chart"
        >
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">📈 Peak Price</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: #3b82f6;">View Chart</div>
        </div>
      </div>
    </div>

    <!-- Average Profit and Holding Time per Sell Section -->
    <div v-if="selectedWallet && statistics && sellStatistics.length > 0" class="card" style="margin-bottom: 20px; padding: 20px;">
      <div class="section-title" style="margin-bottom: 15px;">📈 Average Profit & Holding Time per Sell</div>
      <div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%); border: 1px solid #334155; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.5rem;">💰</span>
        <div style="flex: 1;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Total Sells PNL</div>
          <div style="font-size: 1.3rem; font-weight: 600;" :style="{ color: (totalSellsPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ formatNumber(totalSellsPNL) }} SOL
          </div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
        <div
          v-for="(sellStat, index) in sellStatistics"
          :key="index"
          style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;"
        >
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Sell #{{ sellStat.sellNumber }}</div>
          <div style="font-size: 1rem; font-weight: 600; color: #e0e7ff; margin-bottom: 8px;">{{ sellStat.count || 0 }} sells</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 3px;">Avg PNL: <span :style="{ color: (sellStat.avgPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">{{ formatNumber(sellStat.avgPNL) }}%</span></div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 3px;">Avg Holding Time: {{ formatHoldingTime(sellStat.avgHoldingTime) }}</div>
          <div style="font-size: 0.75rem; color: #94a3b8;">Avg Sell Amount: {{ formatNumber(sellStat.avgSellAmountSOL) }} SOL</div>
        </div>
      </div>
    </div>

    <!-- What-If Data Manipulation Section -->
    <div v-if="selectedWallet" class="card" style="margin-bottom: 20px; padding: 20px; border: 2px solid #3b82f6;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div class="section-title" style="margin-bottom: 0; color: #3b82f6;">🔮 What-If Data Manipulation</div>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" v-model="whatIfModeEnabled" @change="toggleWhatIfMode" style="width: 20px; height: 20px; cursor: pointer;">
          <span style="color: #cbd5e1; font-weight: 600; font-size: 0.9rem;">Enable What-If Mode</span>
        </label>
      </div>
      <div v-show="whatIfModeEnabled" style="padding: 15px; background: #1a1f2e; border-radius: 8px; border: 1px solid #334155;">
        <div style="margin-bottom: 15px; color: #94a3b8; font-size: 0.85rem;">
          Adjust wallet's holding time to see how it changes PNL. Use negative values to test shorter holding times.
        </div>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
          <div style="flex: 1; min-width: 250px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1; font-size: 0.9rem;">
              Adjust 1st Sell Time (seconds)
            </label>
            <input
              v-model.number="whatIfParams.firstSellTimeAdjustment"
              type="number"
              placeholder="e.g., 10 or -5"
              style="width: 100%; padding: 10px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.9rem;"
              title="Adjust first sell time by N seconds. Negative values test shorter holding times."
            >
            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
              Adjusts first sell time by ±N seconds. Uses market cap at adjusted time.
            </div>
          </div>
          <div style="flex: 1; min-width: 250px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1; font-size: 0.9rem;">
              Set All Sells To (seconds after buy)
            </label>
            <input
              v-model.number="whatIfParams.setAllSellsTo"
              type="number"
              placeholder="e.g., 30"
              style="width: 100%; padding: 10px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.9rem;"
              title="Set all sell events to N seconds after buy"
            >
            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
              Sets all sell events to N seconds after buy time.
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button
            @click="calculateWhatIf"
            style="padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: all 0.2s;"
            title="Calculate What-If PNL"
          >
            <span>🔮</span> Calculate What-If
          </button>
          <button
            @click="resetWhatIf"
            style="padding: 10px 20px; background: #334155; color: #e0e7ff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: all 0.2s;"
            title="Reset What-If Mode"
          >
            <span>↺</span> Reset
          </button>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <div v-if="selectedWallet" class="card" style="margin-bottom: 20px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div class="section-title" style="margin-bottom: 0;">🔍 Filters</div>
        <div style="display: flex; gap: 10px;">
          <button
            @click="showColumnVisibilityDialog = true"
            style="padding: 8px 16px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
            title="Toggle Column Visibility"
          >
            <span>👁️</span> Columns
          </button>
          <button
            @click="showAddFilterDialog = true"
            style="padding: 8px 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
            title="Add Filter"
          >
            <span>➕</span> Add Filter
          </button>
          <button
            @click="applyFilters"
            style="padding: 8px 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
            title="Apply Filters"
          >
            <span>✓</span> Apply Filters
          </button>
        </div>
      </div>

      <!-- Dynamic Filters Container -->
      <div v-if="activeFilters.length > 0" style="margin-bottom: 15px;">
        <div
          v-for="(filter, index) in activeFilters"
          :key="index"
          style="margin-bottom: 10px; padding: 12px; background: #1a1f2e; border: 1px solid #334155; border-radius: 6px;"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #e0e7ff; font-weight: 600; font-size: 0.9rem;">{{ getFilterLabel(filter.key) }}</span>
            <button
              @click="removeFilter(index)"
              style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 1.2rem; padding: 0 8px;"
              title="Remove Filter"
            >
              ×
            </button>
          </div>
          <div style="color: #94a3b8; font-size: 0.85rem;">
            Min: {{ formatFilterValue(filter.min) }} - Max: {{ formatFilterValue(filter.max) }}
          </div>
        </div>
      </div>
      <div v-else style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 15px;">
        No filters active. Click "Add Filter" to create one.
      </div>

      <!-- Filter Presets -->
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #334155;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 15px;">
          <span style="color: #cbd5e1; font-size: 0.9rem; font-weight: 600;">Presets:</span>
          <select
            v-model="selectedPreset"
            style="flex: 1; min-width: 200px; padding: 8px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.85rem;"
          >
            <option value="">-- Select a preset --</option>
            <option v-for="preset in filterPresets" :key="preset.name" :value="preset.name">
              {{ preset.name }}
            </option>
          </select>
          <button
            @click="loadFilterPreset"
            style="padding: 8px 16px; background: #334155; color: #e0e7ff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;"
          >
            Load
          </button>
          <button
            @click="showSavePresetModal = true"
            style="padding: 8px 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600;"
          >
            Save
          </button>
          <button
            @click="deleteFilterPreset"
            style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Dashboard Table -->
    <div v-if="selectedWallet">
      <!-- Pagination (Top) -->
      <div v-if="totalPages > 1" style="margin-bottom: 20px; display: flex; justify-content: center; align-items: center; gap: 10px;">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          style="padding: 6px 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"
          :style="{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }"
        >
          ← Previous
        </button>
        <span style="color: #cbd5e1; font-weight: 500; font-size: 0.75rem;">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          style="padding: 6px 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"
          :style="{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }"
        >
          Next →
        </button>
      </div>

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
              <th
                v-for="col in visibleColumns"
                :key="col.key"
                @click="sortByColumn(col.key)"
                style="padding: 10px; text-align: left; font-weight: 600; color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155; cursor: pointer; user-select: none;"
                :style="{ background: sortColumn === col.key ? '#1a1f2e' : '#0f1419' }"
              >
                {{ col.label }}
                <span v-if="sortColumn === col.key" style="margin-left: 4px;">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in sortedData"
              :key="index"
              style="border-bottom: 1px solid #2d3748;"
              @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#0f1419'; }"
              @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = 'transparent'; }"
            >
              <td
                v-for="col in visibleColumns"
                :key="col.key"
                style="padding: 10px; border-bottom: 1px solid #2d3748; font-size: 0.75rem; color: #e0e7ff; font-family: 'Courier New', monospace;"
                :style="getCellStyle(col.key, item)"
              >
                {{ formatCellValue(col.key, item) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else style="text-align: center; padding: 40px; color: #94a3b8;">
      Select a wallet to load dashboard data
    </div>

    <!-- Modals -->
    <!-- Add Filter Modal -->
    <div v-if="showAddFilterDialog" class="modal-overlay" @click.self="showAddFilterDialog = false">
      <div class="modal" style="max-width: 600px; max-height: 80vh;">
        <div class="modal-header">
          <h2>➕ Add Filter</h2>
          <button class="modal-close" @click="showAddFilterDialog = false">×</button>
        </div>
        <div class="modal-body" style="overflow-y: auto;">
          <input
            v-model="filterSearchQuery"
            type="text"
            placeholder="Search data points..."
            style="width: 100%; padding: 10px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.9rem; margin-bottom: 15px;"
          >
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div
              v-for="dataPoint in filteredDataPoints"
              :key="dataPoint.key"
              @click="addFilterFromDataPoint(dataPoint)"
              style="padding: 12px; background: #1a1f2e; border: 1px solid #334155; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
              @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#334155'; target.style.borderColor = '#3b82f6'; }"
              @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#1a1f2e'; target.style.borderColor = '#334155'; }"
            >
              <div style="color: #e0e7ff; font-weight: 600; margin-bottom: 4px;">{{ dataPoint.label }}</div>
              <div style="color: #94a3b8; font-size: 0.85rem;">{{ getFilterTypeLabel(dataPoint.type) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Column Visibility Modal -->
    <div v-if="showColumnVisibilityDialog" class="modal-overlay" @click.self="showColumnVisibilityDialog = false">
      <div class="modal" style="max-width: 600px; max-height: 80vh;">
        <div class="modal-header">
          <h2>👁️ Column Visibility</h2>
          <button class="modal-close" @click="showColumnVisibilityDialog = false">×</button>
        </div>
        <div class="modal-body" style="overflow-y: auto;">
          <div style="margin-bottom: 15px; display: flex; gap: 10px;">
            <button @click="selectAllColumns" style="padding: 6px 12px; background: #334155; color: #e0e7ff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Select All</button>
            <button @click="deselectAllColumns" style="padding: 6px 12px; background: #334155; color: #e0e7ff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Deselect All</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label
              v-for="col in columnDefinitions"
              :key="col.key"
              style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #1a1f2e; border-radius: 4px; cursor: pointer;"
            >
              <input type="checkbox" v-model="columnVisibility[col.key]" style="width: 20px; height: 20px; cursor: pointer;">
              <span style="color: #e0e7ff;">{{ col.label }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Save Preset Modal -->
    <div v-if="showSavePresetModal" class="modal-overlay" @click.self="showSavePresetModal = false">
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <h2>💾 Save Filter Preset</h2>
          <button class="modal-close" @click="showSavePresetModal = false">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1; font-size: 0.9rem;">Preset Name</label>
            <input
              v-model="presetName"
              type="text"
              placeholder="Enter preset name..."
              autocomplete="off"
              style="width: 100%; padding: 10px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.9rem;"
            >
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button
              type="button"
              @click="showSavePresetModal = false"
              style="padding: 10px 20px; background: #334155; color: #e0e7ff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="confirmSavePreset"
              style="padding: 10px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Modals will be added as separate components -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { 
  fetchAllWallets,
  fetchDashboardStatistics,
  fetchDashboardData,
  downloadAllTokensExcel,
  deleteWalletAndTransactions,
  fetchDashboardFilterPresets,
  fetchDashboardFilterPreset,
  saveDashboardFilterPreset,
  deleteDashboardFilterPreset,
  calculateWhatIf as calculateWhatIfAPI,
  fetchWalletActivity
} from '../../services/tradeTracking'

const props = defineProps<{
  walletAddress?: string
}>()

const emit = defineEmits<{
  (e: 'wallet-selected', wallet: string): void
}>()

// State
const selectedWallet = ref(props.walletAddress || '')
const wallets = ref<string[]>([])
const statistics = ref<any>(null)
const dashboardData = ref<any[]>([])
const loading = ref(false)
const walletSolBalance = ref<number | null>(null)
const sellStatistics = ref<any[]>([])
const totalSellsPNL = ref<number>(0)

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(50)
const totalPages = ref(1)
const totalCount = ref(0)

// Sorting
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

// Filters
const activeFilters = ref<any[]>([])
const filterPresets = ref<any[]>([])
const selectedPreset = ref('')
const showAddFilterDialog = ref(false)
const showColumnVisibilityDialog = ref(false)
const showSavePresetModal = ref(false)
const presetName = ref('')
const filterSearchQuery = ref('')

// What-If Mode
const whatIfModeEnabled = ref(false)
const whatIfData = ref<any[]>([])
const whatIfParams = ref({
  firstSellTimeAdjustment: null as number | null,
  setAllSellsTo: null as number | null
})

// Column visibility
const columnVisibility = ref<Record<string, boolean>>({})
const columnDefinitions = ref([
  { key: 'tokenAddress', label: 'Token Address', group: 'Token Info' },
  { key: 'pnlSOL', label: 'PNL SOL', group: 'PNL' },
  { key: 'pnlPercent', label: 'PNL %', group: 'PNL' },
  { key: 'walletBuyAmountSOL', label: 'Buy Amount SOL', group: 'Wallet Buy' },
  { key: 'sells', label: 'Sells', group: 'Sells' }
  // Add more columns as needed
])

// Computed
const visibleColumns = computed(() => {
  return columnDefinitions.value.filter(col => columnVisibility.value[col.key] !== false)
})

const sortedData = computed(() => {
  if (!sortColumn.value) return dashboardData.value
  
  const sorted = [...dashboardData.value].sort((a, b) => {
    const aVal = a[sortColumn.value!]
    const bVal = b[sortColumn.value!]
    
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    
    const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    return sortDirection.value === 'asc' ? comparison : -comparison
  })
  
  return sorted
})

const filteredDataPoints = computed(() => {
  const activeKeys = activeFilters.value.map(f => f.key)
  const available = DATA_POINTS.filter(dp => {
    if (Array.isArray(dp) && dp.field === 'sells') return true
    return !activeKeys.includes(dp.key)
  })
  
  if (!filterSearchQuery.value) return available
  
  const query = filterSearchQuery.value.toLowerCase()
  return available.filter(dp => 
    dp.label.toLowerCase().includes(query) ||
    dp.key.toLowerCase().includes(query)
  )
})

// Data point definitions
const DATA_POINTS = [
  { key: 'pnlSOL', label: 'PNL per token in SOL', type: 'sol', field: 'pnlSOL' },
  { key: 'devBuyAmountSOL', label: 'Dev Buy Amount in SOL', type: 'sol', field: 'devBuyAmountSOL' },
  { key: 'walletBuyAmountSOL', label: 'Wallet Buy Amount in SOL', type: 'sol', field: 'walletBuyAmountSOL' },
  { key: 'pnlPercent', label: '% PNL per token', type: 'percent', field: 'pnlPercent' },
  // Add more data points as needed
]

// Methods
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return typeof value === 'number' ? value.toFixed(2) : String(value)
}

const formatHoldingTime = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '-'
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

const formatFilterValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  return typeof value === 'number' ? value.toFixed(2) : String(value)
}

const formatCellValue = (key: string, item: any): string => {
  const value = item[key]
  if (value === null || value === undefined) return '-'
  if (key === 'tokenAddress') {
    return `${value.substring(0, 8)}...${value.substring(value.length - 6)}`
  }
  if (key === 'sells') {
    return Array.isArray(value) ? value.length.toString() : '0'
  }
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}

const getCellStyle = (key: string, item: any): Record<string, string> => {
  const style: Record<string, string> = {}
  if (key === 'pnlSOL' || key === 'pnlPercent') {
    const value = item[key] || 0
    style.color = value >= 0 ? '#10b981' : '#ef4444'
  }
  return style
}

const getFilterLabel = (key: string): string => {
  const dp = DATA_POINTS.find(d => d.key === key)
  return dp ? dp.label : key
}

const getFilterTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    sol: 'SOL Amount',
    token: 'Token Amount',
    percent: 'Percentage',
    marketcap: 'Market Cap',
    timestamp: 'Date/Time'
  }
  return labels[type] || type
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
      fetchDashboardData(selectedWallet.value, currentPage.value, itemsPerPage.value, activeFilters.value)
    ])
    
    if (statsResult.success) {
      statistics.value = statsResult.statistics
      walletSolBalance.value = statsResult.statistics?.solBalance || null
      sellStatistics.value = statsResult.statistics?.sellStatistics || []
      totalSellsPNL.value = statsResult.statistics?.totalSellsPNL || 0
    }
    
    if (dataResult.success) {
      dashboardData.value = dataResult.data || []
      totalPages.value = dataResult.totalPages || 1
      totalCount.value = dataResult.totalCount || 0
      currentPage.value = dataResult.page || currentPage.value
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

const sortByColumn = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

const addFilterFromDataPoint = (dataPoint: any) => {
  const filter = {
    key: dataPoint.key,
    type: dataPoint.type,
    min: null,
    max: null
  }
  activeFilters.value.push(filter)
  showAddFilterDialog.value = false
}

const removeFilter = (index: number) => {
  activeFilters.value.splice(index, 1)
}

const applyFilters = async () => {
  currentPage.value = 1
  await loadDashboardData()
}

const loadFilterPresets = async () => {
  const result = await fetchDashboardFilterPresets()
  if (result.success) {
    filterPresets.value = result.presets || []
  }
}

const loadFilterPreset = async () => {
  if (!selectedPreset.value) return
  const result = await fetchDashboardFilterPreset(selectedPreset.value)
  if (result.success && result.preset) {
    activeFilters.value = result.preset.filters || []
    await applyFilters()
  }
}

const confirmSavePreset = async () => {
  if (!presetName.value.trim()) {
    alert('Please enter a preset name')
    return
  }
  
  const result = await saveDashboardFilterPreset(presetName.value, activeFilters.value)
  if (result.success) {
    showSavePresetModal.value = false
    presetName.value = ''
    await loadFilterPresets()
  } else {
    alert('Failed to save preset: ' + result.error)
  }
}

const deleteFilterPreset = async () => {
  if (!selectedPreset.value) {
    alert('Please select a preset to delete')
    return
  }
  
  if (!confirm(`Are you sure you want to delete preset "${selectedPreset.value}"?`)) return
  
  const result = await deleteDashboardFilterPreset(selectedPreset.value)
  if (result.success) {
    selectedPreset.value = ''
    await loadFilterPresets()
  } else {
    alert('Failed to delete preset: ' + result.error)
  }
}

const selectAllColumns = () => {
  columnDefinitions.value.forEach(col => {
    columnVisibility.value[col.key] = true
  })
}

const deselectAllColumns = () => {
  columnDefinitions.value.forEach(col => {
    columnVisibility.value[col.key] = false
  })
}

const toggleWhatIfMode = () => {
  if (!whatIfModeEnabled.value) {
    whatIfData.value = []
    whatIfParams.value = { firstSellTimeAdjustment: null, setAllSellsTo: null }
  }
}

const calculateWhatIf = async () => {
  if (!selectedWallet.value) return
  
  const result = await calculateWhatIfAPI(
    selectedWallet.value,
    whatIfParams.value.firstSellTimeAdjustment || undefined,
    whatIfParams.value.setAllSellsTo || undefined
  )
  
  if (result.success) {
    whatIfData.value = result.whatIfData || []
    await loadDashboardData()
  } else {
    alert('Failed to calculate what-if PNL: ' + result.error)
  }
}

const resetWhatIf = () => {
  whatIfModeEnabled.value = false
  whatIfData.value = []
  whatIfParams.value = { firstSellTimeAdjustment: null, setAllSellsTo: null }
  loadDashboardData()
}

const openActiveTimeChart = () => {
  // TODO: Implement chart modal
  alert('Active Time Chart - Coming soon')
}

const openPeakPriceChart = () => {
  // TODO: Implement chart modal
  alert('Peak Price Chart - Coming soon')
}

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadDashboardData()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadDashboardData()
  }
}

// Initialize column visibility
const initializeColumnVisibility = () => {
  const saved = localStorage.getItem('dashboardColumnVisibility')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      columnVisibility.value = parsed.columns || {}
    } catch (e) {
      columnVisibility.value = {}
    }
  }
  
  columnDefinitions.value.forEach(col => {
    if (columnVisibility.value[col.key] === undefined) {
      columnVisibility.value[col.key] = true
    }
  })
}

watch(() => props.walletAddress, (newVal) => {
  if (newVal) {
    selectedWallet.value = newVal
    loadDashboardData()
  }
})

onMounted(async () => {
  initializeColumnVisibility()
  await loadWallets()
  await loadFilterPresets()
  if (selectedWallet.value) {
    await loadDashboardData()
  }
})
</script>

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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 90vw;
  max-height: 90vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #334155;
}

.modal-header h2 {
  margin: 0;
  color: #e0e7ff;
  font-size: 1.2rem;
}

.modal-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #334155;
  color: #e0e7ff;
}

.modal-body {
  padding: 20px;
}
</style>
