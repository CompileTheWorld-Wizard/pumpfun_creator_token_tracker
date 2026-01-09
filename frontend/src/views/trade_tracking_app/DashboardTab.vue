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
          <div v-if="whatIfModeEnabled && whatIfSellTotals" style="font-size: 1.2rem; font-weight: 600;">
            <div style="margin-bottom: 4px;" :style="{ color: (statistics.totalWalletPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
              {{ (statistics.totalWalletPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(statistics.totalWalletPNL) }} SOL
            </div>
            <div style="font-size: 0.9rem; border-top: 1px solid #334155; padding-top: 4px;">
              <span style="color: #3b82f6; font-weight: 600;">🔮 What-If PNL SOL: </span>
              <span :style="{ color: (whatIfSellTotals.totalWhatIfWalletPNL || 0) >= 0 ? '#3b82f6' : '#ef4444' }">
                {{ (whatIfSellTotals.totalWhatIfWalletPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(whatIfSellTotals.totalWhatIfWalletPNL) }} SOL
              </span>
            </div>
          </div>
          <div v-else style="font-size: 1.2rem; font-weight: 600;" :style="{ color: (statistics.totalWalletPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ (statistics.totalWalletPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(statistics.totalWalletPNL) }} SOL
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
          <div v-if="whatIfModeEnabled && whatIfSellTotals" style="font-size: 1.3rem; font-weight: 600;">
            <div style="margin-bottom: 4px;" :style="{ color: (totalSellsPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
              {{ (totalSellsPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(totalSellsPNL) }} SOL
            </div>
            <div style="font-size: 0.9rem; border-top: 1px solid #334155; padding-top: 4px;">
              <span style="color: #3b82f6; font-weight: 600;">🔮 What-If PNL SOL: </span>
              <span :style="{ color: (whatIfSellTotals.totalWhatIfSellPNL || 0) >= 0 ? '#3b82f6' : '#ef4444' }">
                {{ (whatIfSellTotals.totalWhatIfSellPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(whatIfSellTotals.totalWhatIfSellPNL) }} SOL
              </span>
            </div>
          </div>
          <div v-else style="font-size: 1.3rem; font-weight: 600;" :style="{ color: (totalSellsPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
            {{ (totalSellsPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(totalSellsPNL) }} SOL
          </div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
        <div
          v-for="(sellStat, index) in sellStatistics"
          :key="index"
          style="padding: 15px; background: #1a1f2e; border-radius: 6px; border: 1px solid #334155;"
        >
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 10px; font-weight: 600;">
            {{ getOrdinal(sellStat.sellNumber) }} Sell
          </div>
          
          <!-- Total SOL PNL -->
          <div v-if="sellStat.totalSolPNL !== null && sellStat.totalSolPNL !== undefined" style="font-size: 1rem; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.2rem;">💰</span>
            <div style="flex: 1;">
              <div v-if="whatIfModeEnabled && whatIfSellTotals && whatIfSellTotals.sellPNLs[sellStat.sellNumber] !== undefined">
                <div :style="{ color: (sellStat.totalSolPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
                  Total SOL PNL: {{ (sellStat.totalSolPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(sellStat.totalSolPNL) }} SOL
                </div>
                <div style="font-size: 0.85rem; margin-top: 4px; border-top: 1px solid #334155; padding-top: 4px;">
                  <span style="color: #3b82f6; font-weight: 600;">🔮 What-If PNL SOL: </span>
                  <span :style="{ color: (whatIfSellTotals.sellPNLs[sellStat.sellNumber] || 0) >= 0 ? '#3b82f6' : '#ef4444' }">
                    {{ (whatIfSellTotals.sellPNLs[sellStat.sellNumber] || 0) >= 0 ? '+' : '' }}{{ formatNumber(whatIfSellTotals.sellPNLs[sellStat.sellNumber]) }} SOL
                  </span>
                </div>
              </div>
              <div v-else :style="{ color: (sellStat.totalSolPNL || 0) >= 0 ? '#10b981' : '#ef4444' }">
                Total SOL PNL: {{ (sellStat.totalSolPNL || 0) >= 0 ? '+' : '' }}{{ formatNumber(sellStat.totalSolPNL) }} SOL
              </div>
            </div>
          </div>
          
          <!-- Avg Profit -->
          <div v-if="sellStat.avgProfit !== null && sellStat.avgProfit !== undefined" style="font-size: 0.75rem; margin-bottom: 5px;">
            <div v-if="whatIfModeEnabled && whatIfSellTotals && whatIfSellTotals.avgProfits[sellStat.sellNumber] !== undefined && whatIfSellTotals.avgProfits[sellStat.sellNumber] !== null">
              <div :style="{ color: (sellStat.avgProfit || 0) >= 0 ? '#10b981' : '#ef4444' }">
                Avg Profit: {{ (sellStat.avgProfit || 0) >= 0 ? '+' : '' }}{{ formatNumber(sellStat.avgProfit) }}%
              </div>
              <div style="font-size: 0.7rem; margin-top: 3px; border-top: 1px solid #334155; padding-top: 3px;">
                <span style="color: #3b82f6; font-weight: 600;">🔮 What-If Avg Profit: </span>
                <span :style="{ color: (whatIfSellTotals.avgProfits[sellStat.sellNumber] || 0) >= 0 ? '#3b82f6' : '#ef4444' }">
                  {{ (whatIfSellTotals.avgProfits[sellStat.sellNumber] || 0) >= 0 ? '+' : '' }}{{ formatNumber(whatIfSellTotals.avgProfits[sellStat.sellNumber]) }}%
                </span>
              </div>
            </div>
            <div v-else :style="{ color: (sellStat.avgProfit || 0) >= 0 ? '#10b981' : '#ef4444' }">
              Avg Profit: {{ (sellStat.avgProfit || 0) >= 0 ? '+' : '' }}{{ formatNumber(sellStat.avgProfit) }}%
            </div>
          </div>
          
          <!-- Avg Sell % of Buy -->
          <div v-if="sellStat.avgSellPercentOfBuy !== null && sellStat.avgSellPercentOfBuy !== undefined" style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 5px;">
            Avg Sell % of Buy: {{ formatNumber(sellStat.avgSellPercentOfBuy) }}%
          </div>
          
          <!-- Avg Holding Time -->
          <div v-if="sellStat.avgHoldingTime !== null && sellStat.avgHoldingTime !== undefined" style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 5px;">
            Avg Holding Time: {{ formatHoldingTime(sellStat.avgHoldingTime) }}
          </div>
          
          <!-- Total Sells Count -->
          <div v-if="sellStat.totalSells !== null && sellStat.totalSells !== undefined" style="font-size: 0.75rem; color: #94a3b8;">
            Total Sells: {{ sellStat.totalSells }}
          </div>
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
        <FilterItem
          v-for="(filter, index) in activeFilters"
          :key="filter.id || index"
          :filter="filter"
          :data-point="getDataPoint(filter.key)"
          :max-sells="maxSells"
          @update:filter="updateFilter(index, $event)"
          @remove="removeFilter(index)"
        />
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

    <!-- Chart Modals -->
    <ActiveTimeChartModal
      :show="showActiveTimeChart"
      :wallet-address="selectedWallet"
      @close="showActiveTimeChart = false"
    />
    
    <PeakPriceChartModal
      :show="showPeakPriceChart"
      :wallet-address="selectedWallet"
      @close="showPeakPriceChart = false"
    />
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
  calculateWhatIf as calculateWhatIfAPI
} from '../../services/tradeTracking'
import FilterItem from './FilterItem.vue'
import ActiveTimeChartModal from './ActiveTimeChartModal.vue'
import PeakPriceChartModal from './PeakPriceChartModal.vue'

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
const maxSells = ref<number>(0)
const whatIfSellTotals = ref<any>(null)

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
const showActiveTimeChart = ref(false)
const showPeakPriceChart = ref(false)

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
  // PNL Group
  { key: 'pnlSOL', label: 'PNL per token in SOL', order: 0, group: 'PNL' },
  { key: 'pnlPercent', label: '% PNL per token', order: 1, group: 'PNL' },
  
  // Token Info Group
  { key: 'tokenName', label: 'Token Name', order: 2, group: 'Token Info' },
  { key: 'tokenSymbol', label: 'Token Symbol', order: 3, group: 'Token Info' },
  { key: 'tokenAddress', label: 'Token Address', order: 4, group: 'Token Info' },
  { key: 'creatorAddress', label: 'Creator Address', order: 5, group: 'Token Info' },
  { key: 'creatorTokenCount', label: 'Creator Token Count', order: 6, group: 'Token Info' },
  { key: 'numberOfSocials', label: 'Number of Socials', order: 7, group: 'Token Info' },
  
  // Dev Buy Group
  { key: 'devBuyAmountSOL', label: 'Dev Buy Amount in SOL', order: 8, group: 'Dev Buy' },
  { key: 'devBuyAmountTokens', label: 'Dev Buy Amount in Tokens', order: 11, group: 'Dev Buy' },
  
  // Wallet Buy Group
  { key: 'walletBuyAmountSOL', label: 'Wallet Buy Amount in SOL', order: 9, group: 'Wallet Buy' },
  { key: 'walletBuyAmountTokens', label: 'Wallet Buy Amount in Tokens', order: 12, group: 'Wallet Buy' },
  { key: 'walletBuySOLPercentOfDev', label: 'Wallet buy SOL % of dev', order: 10, group: 'Wallet Buy' },
  { key: 'walletBuyTokensPercentOfDev', label: 'Wallet buy Tokens % of dev', order: 13, group: 'Wallet Buy' },
  
  // Supply Percentages Group
  { key: 'devBuyTokensPercentOfTotalSupply', label: 'Dev buy Tokens % of total supply', order: 14, group: 'Supply Percentages' },
  { key: 'walletBuyPercentOfTotalSupply', label: 'Wallet buy % of total supply', order: 15, group: 'Supply Percentages' },
  { key: 'walletBuyPercentOfRemainingSupply', label: 'Wallet buy % of the remaining supply', order: 16, group: 'Supply Percentages' },
  
  // Price & Market Cap Group
  { key: 'tokenPeakPriceBeforeFirstSell', label: 'Token Peak Price Before 1st Sell', order: 17, group: 'Price & Market Cap' },
  { key: 'tokenPeakPrice10sAfterFirstSell', label: 'Token Peak Price 10s After 1st Sell', order: 18, group: 'Price & Market Cap' },
  { key: 'walletBuyMarketCap', label: 'Wallet Buy Market Cap', order: 23, group: 'Price & Market Cap' },
  
  // Buy Counts Group
  { key: 'buysBeforeFirstSell', label: 'Buys Before First Sell', order: 26, group: 'Buy Counts' },
  { key: 'buysAfterFirstSell', label: 'Buys After First Sell (10s)', order: 27, group: 'Buy Counts' },
  
  // Position & Timing Group
  { key: 'walletBuyPositionAfterDev', label: 'Wallet Buy Position After Dev', order: 19, group: 'Position & Timing' },
  { key: 'walletBuyBlockNumber', label: 'Wallet Buy Block #', order: 20, group: 'Position & Timing' },
  { key: 'walletBuyBlockNumberAfterDev', label: 'Wallet Buy Block # After Dev', order: 21, group: 'Position & Timing' },
  { key: 'walletBuyTimestamp', label: 'Wallet Buy Timestamp', order: 22, group: 'Position & Timing' },
  
  // Transaction Group
  { key: 'walletGasAndFeesAmount', label: 'Wallet Gas & Fees Amount', order: 24, group: 'Transaction' },
  { key: 'transactionSignature', label: 'Transaction Signature', order: 25, group: 'Transaction' }
])

// Computed
const visibleColumns = computed(() => {
  return columnDefinitions.value
    .filter(col => columnVisibility.value[col.key] !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
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
    if (dp.isArray && dp.field === 'sells') return true
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
  // SOL Amount filters
  { key: 'pnlSOL', label: 'PNL per token in SOL', type: 'sol', field: 'pnlSOL' },
  { key: 'devBuyAmountSOL', label: 'Dev Buy Amount in SOL', type: 'sol', field: 'devBuyAmountSOL' },
  { key: 'walletBuyAmountSOL', label: 'Wallet Buy Amount in SOL', type: 'sol', field: 'walletBuyAmountSOL' },
  { key: 'walletGasAndFeesAmount', label: 'Wallet Gas & Fees Amount', type: 'sol', field: 'walletGasAndFeesAmount' },
  
  // Market Cap filters
  { key: 'walletBuyMarketCap', label: 'Wallet Buy Market Cap', type: 'marketcap', field: 'walletBuyMarketCap' },
  { key: 'tokenPeakMarketCapBeforeFirstSell', label: 'Token Peak Market Cap Before 1st Sell', type: 'marketcap', field: 'tokenPeakMarketCapBeforeFirstSell' },
  { key: 'tokenPeakMarketCap10sAfterFirstSell', label: 'Token Peak Market Cap 10s After 1st Sell', type: 'marketcap', field: 'tokenPeakMarketCap10sAfterFirstSell' },
  { key: 'walletBuyBlockNumberAfterDev', label: 'Wallet Block # after dev', type: 'marketcap', field: 'walletBuyBlockNumberAfterDev' },
  { key: 'walletBuyPositionAfterDev', label: 'Wallet Position after dev', type: 'marketcap', field: 'walletBuyPositionAfterDev' },
  
  // Token Amount filters
  { key: 'devBuyAmountTokens', label: 'Dev Buy Amount in Tokens', type: 'token', field: 'devBuyAmountTokens' },
  { key: 'walletBuyAmountTokens', label: 'Wallet Buy Amount in Tokens', type: 'token', field: 'walletBuyAmountTokens' },
  
  // Percentage filters
  { key: 'pnlPercent', label: '% PNL per token', type: 'percent', field: 'pnlPercent' },
  { key: 'walletBuySOLPercentOfDev', label: 'Wallet buy SOL % of dev', type: 'percent', field: 'walletBuySOLPercentOfDev' },
  { key: 'walletBuyTokensPercentOfDev', label: 'Wallet buy Tokens % of dev', type: 'percent', field: 'walletBuyTokensPercentOfDev' },
  { key: 'devBuyTokensPercentOfTotalSupply', label: 'Dev buy Tokens % of total supply', type: 'percent', field: 'devBuyTokensPercentOfTotalSupply' },
  { key: 'walletBuyPercentOfTotalSupply', label: 'Wallet buy % of total supply', type: 'percent', field: 'walletBuyPercentOfTotalSupply' },
  { key: 'walletBuyPercentOfRemainingSupply', label: 'Wallet buy % of the remaining supply', type: 'percent', field: 'walletBuyPercentOfRemainingSupply' },
  
  // Sell-related filters
  { key: 'sellAmountSOL', label: 'Wallet Sell Amount in SOL', type: 'sol', field: 'sells', isArray: true, arrayField: 'sellAmountSOL' },
  { key: 'sellAmountTokens', label: 'Wallet Sell Amount in Tokens', type: 'token', field: 'sells', isArray: true, arrayField: 'sellAmountTokens' },
  { key: 'sellMarketCap', label: 'Wallet Sell Market Cap', type: 'marketcap', field: 'sells', isArray: true, arrayField: 'marketCap' },
  { key: 'sellPercentOfBuy', label: 'Sell % of Buy', type: 'percent', field: 'sells', isArray: true, arrayField: 'sellPercentOfBuy' },
  { key: 'firstSellPNL', label: 'Sell PNL', type: 'percent', field: 'sells', isArray: true, arrayField: 'firstSellPNL' },
  { key: 'sellTimestamp', label: 'Wallet Sell Timestamp', type: 'timestamp', field: 'sells', isArray: true, arrayField: 'timestamp' },
  
  // Timestamp filters
  { key: 'walletBuyTimestamp', label: 'Wallet Buy Timestamp', type: 'timestamp', field: 'walletBuyTimestamp' }
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

const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const formatCellValue = (key: string, item: any): string => {
  const value = item[key]
  if (value === null || value === undefined) return '-'
  
  // Handle address truncation
  if (key.includes('Address') || key === 'transactionSignature') {
    if (typeof value === 'string' && value.length > 14) {
      return `${value.substring(0, 8)}...${value.substring(value.length - 6)}`
    }
    return String(value)
  }
  
  // Handle sells array
  if (key === 'sells') {
    return Array.isArray(value) ? value.length.toString() : '0'
  }
  
  // Handle timestamps
  if (key.includes('Timestamp') || key.includes('Time')) {
    try {
      return new Date(value).toLocaleString()
    } catch {
      return String(value)
    }
  }
  
  // Handle percentages
  if (key.includes('Percent') || key.includes('%')) {
    if (typeof value === 'number') {
      return `${value.toFixed(2)}%`
    }
    return String(value)
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    // For large numbers, use locale string
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    return value.toFixed(2)
  }
  
  return String(value)
}

const getCellStyle = (key: string, item: any): Record<string, string> => {
  const style: Record<string, string> = {}
  
  // Color code PNL values
  if (key === 'pnlSOL' || key === 'pnlPercent') {
    const value = item[key] || 0
    style.color = value >= 0 ? '#10b981' : '#ef4444'
  }
  
  // Monospace for addresses and signatures
  if (key.includes('Address') || key === 'transactionSignature' || key.includes('Block')) {
    style.fontFamily = "'Courier New', monospace"
    style.fontSize = '0.7rem'
  }
  
  return style
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
      
      // Calculate max sells from dashboard data
      if (dataResult.success && dataResult.data) {
        maxSells.value = Math.max(...(dataResult.data.map((item: any) => (item.sells?.length || 0))), 0)
      }
      
      // Recalculate what-if totals if what-if mode is enabled
      if (whatIfModeEnabled.value && whatIfData.value.length > 0) {
        calculateWhatIfSellTotals()
      }
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

const getDataPoint = (key: string) => {
  return DATA_POINTS.find(dp => dp.key === key)
}

const addFilterFromDataPoint = (dataPoint: any) => {
  const config = getFilterConfig(dataPoint.type)
  
  const filter: any = {
    id: Date.now() + Math.random(),
    key: dataPoint.key,
    label: dataPoint.label,
    type: dataPoint.type,
    min: config.defaultMin,
    max: config.defaultMax
  }
  
  // Add sellNumber for sell filters
  if (dataPoint.isArray && dataPoint.field === 'sells') {
    const existingFiltersForThisKey = activeFilters.value.filter(f => f.key === dataPoint.key)
    const existingSellNumbers = existingFiltersForThisKey
      .filter(f => f.sellNumber !== null && f.sellNumber !== undefined)
      .map(f => f.sellNumber)
      .sort((a, b) => a - b)
    
    let defaultSellNumber = 1
    for (let i = 1; i <= 20; i++) {
      if (!existingSellNumbers.includes(i)) {
        defaultSellNumber = i
        break
      }
    }
    
    filter.sellNumber = defaultSellNumber
  } else {
    // For non-sell filters, prevent duplicates
    if (activeFilters.value.find(f => f.key === dataPoint.key)) {
      return
    }
  }
  
  activeFilters.value.push(filter)
  showAddFilterDialog.value = false
}

const updateFilter = (index: number, updatedFilter: any) => {
  activeFilters.value[index] = updatedFilter
}

const removeFilter = (index: number) => {
  activeFilters.value.splice(index, 1)
}

function getFilterConfig(type: string) {
  switch(type) {
    case 'sol':
      return { min: -20, max: 20, defaultMin: -20, defaultMax: 20, step: 0.01, minLabel: '-20', maxLabel: '20+' }
    case 'token':
      return { min: 0, max: 1000000000, defaultMin: 0, defaultMax: 1000000000, step: 1, maxLabel: '10^9+' }
    case 'percent':
      return { min: -100, max: 100, defaultMin: -100, defaultMax: 100, step: 0.01, minLabel: '-100%', maxLabel: '100%' }
    case 'marketcap':
      return { min: 0, max: 10000, defaultMin: 0, defaultMax: 10000, step: 0.01, minLabel: '0', maxLabel: '10,000+' }
    case 'timestamp':
      return { min: null, max: null, defaultMin: null, defaultMax: null, step: null }
    default:
      return { min: 0, max: 100, defaultMin: 0, defaultMax: 100, step: 0.01 }
  }
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
    whatIfSellTotals.value = null
    whatIfParams.value = { firstSellTimeAdjustment: null, setAllSellsTo: null }
  } else {
    // Recalculate if data exists
    if (whatIfData.value.length > 0) {
      calculateWhatIfSellTotals()
    }
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
    calculateWhatIfSellTotals()
    await loadDashboardData()
  } else {
    alert('Failed to calculate what-if PNL: ' + result.error)
  }
}

const calculateWhatIfSellTotals = () => {
  if (!whatIfModeEnabled.value || !whatIfData.value || whatIfData.value.length === 0) {
    whatIfSellTotals.value = null
    return
  }
  
  const sellPNLs: Record<number, number> = {}
  const avgProfits: Record<number, number | null> = {}
  let totalWhatIfSellPNL = 0
  let totalWhatIfWalletPNL = 0
  let totalWhatIfBuyAmountSOL = 0
  let totalWhatIfGasAndFees = 0
  
  whatIfData.value.forEach((tokenData: any) => {
    const tokenBuyAmount = tokenData.walletBuyAmountSOL || 0
    const tokenGasAndFees = tokenData.totalGasAndFees || 0
    totalWhatIfBuyAmountSOL += tokenBuyAmount
    totalWhatIfGasAndFees += tokenGasAndFees
    
    if (tokenData.sells && tokenData.sells.length > 0) {
      let tokenTotalAdjustedSellAmount = 0
      tokenData.sells.forEach((sell: any) => {
        const sellNumber = sell.sellNumber
        if (!sellPNLs[sellNumber]) {
          sellPNLs[sellNumber] = 0
        }
        const adjustedPNL = sell.adjustedSellPNL || 0
        sellPNLs[sellNumber] += adjustedPNL
        totalWhatIfSellPNL += adjustedPNL
        tokenTotalAdjustedSellAmount += sell.adjustedSellAmountSOL || 0
      })
      
      // Calculate token-level PNL
      const tokenPNL = tokenTotalAdjustedSellAmount - tokenBuyAmount - tokenGasAndFees
      totalWhatIfWalletPNL += tokenPNL
    } else {
      // No sells - loss is the buy amount + fees
      totalWhatIfWalletPNL -= (tokenBuyAmount + tokenGasAndFees)
    }
  })
  
  // Calculate averages
  Object.keys(sellPNLs).forEach(sellNumStr => {
    const sellNum = parseInt(sellNumStr)
    const count = sellStatistics.value.find(s => s.sellNumber === sellNum)?.totalSells || 0
    if (count > 0) {
      avgProfits[sellNum] = sellPNLs[sellNum] / count
    } else {
      avgProfits[sellNum] = null
    }
  })
  
  whatIfSellTotals.value = {
    sellPNLs,
    avgProfits,
    totalWhatIfSellPNL,
    totalWhatIfWalletPNL
  }
}

const resetWhatIf = () => {
  whatIfModeEnabled.value = false
  whatIfData.value = []
  whatIfSellTotals.value = null
  whatIfParams.value = { firstSellTimeAdjustment: null, setAllSellsTo: null }
  loadDashboardData()
}

const openActiveTimeChart = () => {
  if (!selectedWallet.value) {
    alert('Please select a wallet first')
    return
  }
  showActiveTimeChart.value = true
}

const openPeakPriceChart = () => {
  if (!selectedWallet.value) {
    alert('Please select a wallet first')
    return
  }
  showPeakPriceChart.value = true
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
