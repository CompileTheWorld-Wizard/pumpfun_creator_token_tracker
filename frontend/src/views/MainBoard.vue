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
              @click="showManageDialog = true"
              class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-gray-500/50 flex items-center gap-2"
            >
              <span class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(manageBlacklistIconSvg)"></span>
              Manage Blacklist
            </button>
            <button
              @click="showClearDatabaseDialog = true"
              class="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-red-500/50 flex items-center gap-2"
            >
              <span class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(clearDatabaseIconSvg)"></span>
              Clear Database
            </button>
            <button
              @click="showChangePasswordDialog = true"
              class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-gray-500/50 flex items-center gap-2"
            >
              <span class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(changePasswordIconSvg)"></span>
              Change Password
            </button>
            <button
              @click="toggleTracking"
              :disabled="wallets.length === 0 || trackingLoading"
              :class="[
                'px-4 py-2 text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 flex items-center gap-2',
                isTracking
                  ? 'bg-red-600/90 hover:bg-red-600 text-white focus:ring-red-500/50'
                  : 'bg-green-600/90 hover:bg-green-600 text-white focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed'
              ]"
            >
              <div v-if="trackingLoading" class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span v-if="!trackingLoading" class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(startTrackingIconSvg)"></span>
              <span v-if="isTracking">Stop Tracking</span>
              <span v-else>Start Tracking</span>
            </button>
            <button
              @click="handleLogout"
              class="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition focus:outline-none focus:ring-2 focus:ring-red-500/50 flex items-center gap-2"
            >
              <span class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(logoutIconSvg)"></span>
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
          <p class="text-2xl font-bold text-blue-400">{{ pagination.total }}</p>
          <p class="text-xs text-gray-500 mt-0.5">Total</p>
        </div>

        <!-- Bonded Rate -->
        <div class="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Bonded Rate</h3>
            <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p v-if="!selectedCreatorWallet || !walletStats" class="text-lg font-semibold text-gray-500">Select wallet</p>
          <template v-else>
            <p class="text-2xl font-bold text-green-400">{{ walletStats.bondedRate.toFixed(1) }}%</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ walletStats.bondedTokens }}/{{ walletStats.totalTokens }}</p>
          </template>
        </div>
        
        <!-- Average ATH MCap -->
        <div class="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 border border-cyan-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Avg ATH MCap</h3>
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <p v-if="!selectedCreatorWallet || !walletStats || walletStats.avgAthMcap === null" class="text-lg font-semibold text-gray-500">Select wallet</p>
          <template v-else>
            <p class="text-2xl font-bold text-cyan-400">${{ formatCurrency(walletStats.avgAthMcap) }}</p>
            <p class="text-xs text-gray-500 mt-0.5">Average</p>
          </template>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="mb-3 flex items-center gap-3 flex-wrap">
        <label class="text-xs text-gray-400 font-medium">Filter by Creator Wallet:</label>
        <select
          v-model="selectedCreatorWallet"
          @change="handleFilterChange"
          class="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 min-w-[250px]"
        >
          <option value="">All Wallets</option>
          <option v-for="wallet in wallets" :key="wallet.address" :value="wallet.address">
            {{ wallet.nickname || formatWalletAddress(wallet.address) }}
          </option>
        </select>
        <label class="text-xs text-gray-400 font-medium ml-3">Items per page:</label>
        <select
          v-model="itemsPerPage"
          @change="handleItemsPerPageChange"
          class="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option value="all">All</option>
        </select>
      </div>

      <!-- Error State -->
      <div v-if="error" class="bg-red-900/20 border border-red-500/30 rounded p-2 mb-3">
        <p class="text-red-400 text-xs">{{ error }}</p>
      </div>

      <!-- Tokens Table -->
      <div class="bg-gray-900/80 border border-gray-800 rounded overflow-hidden flex flex-col">
        <div class="overflow-x-auto overflow-y-auto relative" style="max-height: calc(100vh - 350px);">
          <!-- Loading Overlay -->
          <div v-if="loading" class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-0" style="top: 0;">
            <div class="flex items-center gap-2 bg-gray-900/60 backdrop-blur-md px-4 py-3 rounded-lg border border-gray-700/50">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
              <span class="text-xs text-gray-200 font-medium">Loading tokens...</span>
            </div>
          </div>
          <table class="w-full text-xs relative">
            <thead class="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
              <tr>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Token</th>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Initial MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Peak MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Final MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ATH MC</th>
                <th class="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Trades</th>
                <th class="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chart</th>
                <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <!-- Empty State -->
              <tr v-if="!loading && tokens.length === 0">
                <td :colspan="11" class="px-2 py-8 text-center">
                  <p class="text-gray-400 text-xs font-semibold mb-1">
                    {{ selectedCreatorWallet ? 'No tokens found for this wallet' : 'No tokens tracked yet' }}
                  </p>
                  <p class="text-gray-500 text-[10px]">
                    {{ selectedCreatorWallet ? 'Try selecting a different wallet' : 'Tokens created by tracked wallets will appear here' }}
                  </p>
                </td>
              </tr>
              <!-- Token Rows -->
              <tr
                v-for="token in tokens"
                :key="token.mint"
                class="hover:bg-gray-800/50 transition cursor-pointer"
                @click="selectedToken = token"
              >
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <button
                      @click.stop="copyToClipboard(token.mint)"
                      class="p-0.5 hover:bg-gray-700 rounded transition flex-shrink-0"
                      :class="copiedToken === token.mint ? 'text-green-400' : 'text-gray-400 hover:text-purple-400'"
                      :title="copiedToken === token.mint ? 'Copied!' : 'Copy token address'"
                    >
                      <span class="w-3 h-3 inline-flex items-center justify-center" v-html="processSvg(copiedToken === token.mint ? checkIconSvg : copyIconSvg, 'w-3 h-3')"></span>
                    </button>
                    <div>
                      <div class="text-xs font-semibold text-gray-100">{{ token.name || 'Unnamed Token' }}</div>
                      <div class="text-[10px] text-gray-500 font-mono">{{ formatAddress(token.mint) }}</div>
                    </div>
                    <span class="px-1.5 py-0.5 bg-purple-600/20 text-purple-400 text-[10px] font-semibold rounded">
                      {{ token.symbol }}
                    </span>
                  </div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <button
                      @click.stop="copyToClipboard(token.creator)"
                      class="p-0.5 hover:bg-gray-700 rounded transition flex-shrink-0"
                      :class="copiedToken === token.creator ? 'text-green-400' : 'text-gray-400 hover:text-purple-400'"
                      :title="copiedToken === token.creator ? 'Copied!' : 'Copy creator wallet address'"
                    >
                      <span class="w-3 h-3 inline-flex items-center justify-center" v-html="processSvg(copiedToken === token.creator ? checkIconSvg : copyIconSvg, 'w-3 h-3')"></span>
                    </button>
                    <div class="text-[10px] text-gray-400 font-mono">{{ formatAddress(token.creator) }}</div>
                  </div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <span
                    :class="token.bonded ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'"
                    class="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                  >
                    {{ token.bonded ? 'Bonded' : 'Bonding' }}
                  </span>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-right">
                  <div class="text-xs font-semibold text-gray-200">${{ formatCurrency(token.initialMarketCapUsd) }}</div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-right">
                  <div class="text-xs font-semibold text-green-400">${{ formatCurrency(token.peakMarketCapUsd) }}</div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-right">
                  <div class="text-xs font-semibold text-gray-200">${{ formatCurrency(token.finalMarketCapUsd) }}</div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-right">
                  <div class="text-xs font-semibold text-green-400">${{ formatCurrency(token.athMarketCapUsd) }}</div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-right">
                  <div class="text-xs font-semibold text-gray-200">{{ token.tradeCount15s }}</div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <div class="text-[10px] text-gray-400">{{ formatDate(token.createdAt) }}</div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  <div v-if="token.marketCapTimeSeries && token.marketCapTimeSeries.length > 0" class="w-16 h-8">
                    <canvas :ref="el => setChartRef(token.mint, el as HTMLCanvasElement | null)" class="w-full h-full"></canvas>
                  </div>
                  <div v-else class="w-16 h-8 flex items-center justify-center">
                    <span class="text-[10px] text-gray-600">No data</span>
                  </div>
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap text-center">
                  <button
                    @click.stop="selectedToken = token"
                    class="px-2 py-1 bg-purple-600/90 hover:bg-purple-600 text-white text-[10px] font-semibold rounded transition"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Controls -->
        <div v-if="pagination.total > 0" class="px-4 py-3 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
          <div class="text-xs text-gray-400">
            <span v-if="itemsPerPage === 'all'">
              Showing all {{ pagination.total }} token{{ pagination.total !== 1 ? 's' : '' }}
            </span>
            <span v-else>
              Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} tokens
            </span>
          </div>
          <div v-if="pagination.totalPages > 1" class="flex items-center gap-2">
            <button
              @click="goToPage(pagination.page - 1)"
              :disabled="pagination.page === 1"
              class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div class="flex items-center gap-1">
              <button
                v-for="page in visiblePages"
                :key="page"
                @click="goToPage(page)"
                :class="[
                  'px-2 py-1 text-xs rounded transition min-w-[32px]',
                  page === pagination.page
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                ]"
              >
                {{ page }}
              </button>
            </div>
            <button
              @click="goToPage(pagination.page + 1)"
              :disabled="pagination.page === pagination.totalPages"
              class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Manage Blacklist Dialog -->
    <div 
      v-if="showManageDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="closeManageDialog"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Manage Blacklist</h3>
          <button
            @click="closeManageDialog"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <span class="w-5 h-5 inline-flex items-center justify-center" v-html="processSvg(closeIconSvg, 'w-5 h-5')"></span>
          </button>
        </div>
        
        <!-- Add Wallet Form -->
        <div class="mb-6 pb-6 border-b border-gray-800">
          <h4 class="text-sm font-semibold text-gray-300 mb-3">Add New Wallet</h4>
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

            <div>
              <label for="walletNickname" class="block text-xs font-semibold text-gray-300 mb-1.5">
                Nickname (Optional)
              </label>
              <input
                id="walletNickname"
                v-model="walletNicknameInput"
                type="text"
                class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
                placeholder="Enter a nickname for this wallet"
                :disabled="addingWallet"
              />
              <p class="mt-1.5 text-xs text-gray-500">Optional: Give this wallet a friendly name</p>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                @click="walletAddressInput = ''; walletError = ''"
                class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
                :disabled="addingWallet"
              >
                Clear
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

        <!-- Wallet List -->
        <div>
          <h4 class="text-sm font-semibold text-gray-300 mb-3">Blacklisted Wallets</h4>
          
          <!-- Search Box -->
          <div v-if="wallets.length > 0" class="mb-3">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search wallet addresses..."
                class="w-full px-3 py-2 pl-9 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm font-mono"
              />
              <span class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2 inline-flex items-center justify-center" v-html="processSvg(searchIconSvg)"></span>
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              >
                <span class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(closeIconSvg)"></span>
              </button>
            </div>
          </div>
          
          <!-- Wallet List with Scroll Area -->
          <div v-if="filteredWallets.length > 0" class="max-h-64 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            <div 
              v-for="wallet in filteredWallets" 
              :key="wallet.address"
              class="flex items-center gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-purple-500/50 transition"
            >
              <button
                @click="copyWalletAddress(wallet.address)"
                class="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-900/20 rounded transition flex-shrink-0"
                :title="copiedAddress === wallet.address ? 'Copied!' : 'Copy address'"
              >
                <span class="w-4 h-4 inline-flex items-center justify-center" :class="copiedAddress === wallet.address ? 'text-green-400' : ''" v-html="processSvg(copiedAddress === wallet.address ? checkIconSvg : copyIconSvg)"></span>
              </button>
              <div class="flex-1 min-w-0">
                <p v-if="wallet.nickname" class="text-sm font-semibold text-gray-200">{{ wallet.nickname }}</p>
                <p class="text-xs font-mono text-gray-400 break-all">{{ formatWalletAddress(wallet.address) }}</p>
              </div>
              <button
                @click="removeWalletByAddress(wallet.address)"
                class="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition flex-shrink-0"
                title="Remove wallet"
              >
                <span class="w-4 h-4 inline-flex items-center justify-center" v-html="processSvg(trashIconSvg)"></span>
              </button>
            </div>
          </div>
          
          <!-- Empty State -->
          <div v-else class="text-center py-8 border border-dashed border-gray-800 rounded-lg bg-gray-950/50">
            <svg class="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <p class="text-gray-400 text-sm font-semibold mb-1">No wallets blacklisted</p>
            <p class="text-gray-500 text-xs">Add wallets to blacklist to exclude them from tracking</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Clear Database Dialog -->
    <div 
      v-if="showClearDatabaseDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="closeClearDatabaseDialog"
    >
      <div class="bg-gray-900 border border-red-500/50 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-red-400">⚠️ Clear Database</h3>
          <button
            @click="closeClearDatabaseDialog"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <span class="w-5 h-5 inline-flex items-center justify-center" v-html="processSvg(closeIconSvg, 'w-5 h-5')"></span>
          </button>
        </div>
        
        <div class="mb-4">
          <div class="bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4">
            <p class="text-sm font-semibold mb-2">⚠️ DANGER: This action cannot be undone!</p>
            <p class="text-xs text-red-200">
              This will permanently delete ALL data from the database including:
            </p>
            <ul class="text-xs text-red-200 mt-2 ml-4 list-disc">
              <li>All tracked tokens</li>
              <li>All blacklisted wallets</li>
              <li>All market cap data</li>
              <li>All statistics</li>
            </ul>
            <p class="text-xs text-red-200 mt-2 font-semibold">
              Only the password will be preserved.
            </p>
          </div>
        </div>
        
        <form @submit.prevent="handleClearDatabase" class="space-y-4">
          <div>
            <label for="clearPassword" class="block text-xs font-semibold text-gray-300 mb-1.5">
              Enter Password to Confirm
            </label>
            <input
              id="clearPassword"
              v-model="clearDatabasePassword"
              type="password"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition text-sm"
              placeholder="Enter your password"
              :disabled="clearingDatabase"
            />
            <p v-if="clearDatabaseError" class="mt-1.5 text-xs text-red-400">{{ clearDatabaseError }}</p>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="closeClearDatabaseDialog"
              class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
              :disabled="clearingDatabase"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="clearingDatabase || !clearDatabasePassword"
              class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="clearingDatabase">Clearing...</span>
              <span v-else>Clear All Data</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Change Password Dialog -->
    <div 
      v-if="showChangePasswordDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="closeChangePasswordDialog"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-100">Change Password</h3>
          <button
            @click="closeChangePasswordDialog"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <span class="w-5 h-5 inline-flex items-center justify-center" v-html="processSvg(closeIconSvg, 'w-5 h-5')"></span>
          </button>
        </div>
        
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label for="currentPassword" class="block text-xs font-semibold text-gray-300 mb-1.5">
              Current Password
            </label>
            <input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
              placeholder="Enter current password"
              :disabled="changingPassword"
            />
          </div>

          <div>
            <label for="newPassword" class="block text-xs font-semibold text-gray-300 mb-1.5">
              New Password
            </label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
              placeholder="Enter new password (min 6 characters)"
              :disabled="changingPassword"
            />
            <p class="mt-1.5 text-xs text-gray-500">Password must be at least 6 characters long</p>
          </div>

          <div>
            <label for="confirmPassword" class="block text-xs font-semibold text-gray-300 mb-1.5">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              class="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-sm"
              placeholder="Confirm new password"
              :disabled="changingPassword"
            />
            <p v-if="passwordMismatch" class="mt-1.5 text-xs text-red-400">Passwords do not match</p>
          </div>

          <div v-if="passwordError" class="bg-red-950/50 border border-red-800 text-red-300 px-3 py-2 rounded-lg text-sm">
            {{ passwordError }}
          </div>

          <div v-if="passwordSuccess" class="bg-green-950/50 border border-green-800 text-green-300 px-3 py-2 rounded-lg text-sm">
            {{ passwordSuccess }}
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="closeChangePasswordDialog"
              class="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition"
              :disabled="changingPassword"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="changingPassword || passwordMismatch || !currentPassword || !newPassword || !confirmPassword"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-purple-500 hover:via-blue-500 hover:to-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="changingPassword">Changing...</span>
              <span v-else>Change Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Token Detail Modal -->
    <div
      v-if="selectedToken"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="selectedToken = null"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-100">{{ selectedToken.name || 'Unnamed Token' }}</h2>
            <p class="text-sm text-gray-500 font-mono mt-1">{{ selectedToken.mint }}</p>
          </div>
          <button
            @click="selectedToken = null"
            class="text-gray-400 hover:text-gray-200 transition"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Token Info -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">Symbol</p>
            <p class="text-lg font-bold text-gray-200">{{ selectedToken.symbol }}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">Status</p>
            <p class="text-lg font-bold" :class="selectedToken.bonded ? 'text-green-400' : 'text-yellow-400'">
              {{ selectedToken.bonded ? 'Bonded' : 'Bonding Curve' }}
            </p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">Trades (15s)</p>
            <p class="text-lg font-bold text-gray-200">{{ selectedToken.tradeCount15s }}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-4">
            <p class="text-xs text-gray-500 mb-1">ATH Market Cap</p>
            <p class="text-lg font-bold text-green-400">
              ${{ formatCurrency(selectedToken.athMarketCapUsd) }}
            </p>
          </div>
        </div>

        <!-- Market Cap Stats -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Initial Market Cap</p>
            <p class="text-2xl font-bold text-blue-400">
              ${{ formatCurrency(selectedToken.initialMarketCapUsd) }}
            </p>
          </div>
          <div class="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Peak Market Cap</p>
            <p class="text-2xl font-bold text-green-400">
              ${{ formatCurrency(selectedToken.peakMarketCapUsd) }}
            </p>
          </div>
          <div class="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Final Market Cap</p>
            <p class="text-2xl font-bold text-purple-400">
              ${{ formatCurrency(selectedToken.finalMarketCapUsd) }}
            </p>
          </div>
        </div>

        <!-- Market Cap Chart -->
        <div v-if="selectedToken.marketCapTimeSeries && selectedToken.marketCapTimeSeries.length > 0" class="mb-6">
          <h3 class="text-lg font-bold text-gray-100 mb-4">Market Cap Time Series (First 15 Seconds)</h3>
          <div class="bg-gray-800/30 rounded-lg p-4 relative">
            <canvas 
              ref="detailChartRef" 
              class="w-full" 
              style="height: 300px;"
              @mousemove="handleChartMouseMove"
              @mouseleave="handleChartMouseLeave"
            ></canvas>
            <!-- Tooltip -->
            <div
              v-if="chartTooltip.show"
              :style="{
                position: 'absolute',
                left: chartTooltip.x + 'px',
                top: chartTooltip.y + 'px',
                pointerEvents: 'none',
                zIndex: 1000
              }"
              class="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl min-w-[200px]"
            >
              <div class="text-xs space-y-1">
                <div class="flex justify-between gap-4">
                  <span class="text-gray-400">Time:</span>
                  <span class="text-gray-200 font-semibold">{{ chartTooltip.time }}</span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-gray-400">Market Cap:</span>
                  <span class="text-purple-400 font-semibold">${{ formatCurrency(chartTooltip.marketCap) }}</span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-gray-400">Price (SOL):</span>
                  <span class="text-blue-400 font-semibold">
                    {{ formatPriceSol(chartTooltip.priceSol) }}
                  </span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-gray-400">Trade Type:</span>
                  <span 
                    class="font-semibold"
                    :class="chartTooltip.tradeType === 'buy' ? 'text-green-400' : 'text-red-400'"
                  >
                    {{ chartTooltip.tradeType === 'buy' ? 'Buy' : 'Sell' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="mb-6">
          <div class="bg-gray-800/30 rounded-lg p-8 text-center">
            <p class="text-gray-500 text-sm">No market cap data available</p>
          </div>
        </div>

        <!-- Transaction Link -->
        <div class="flex justify-end">
          <a
            :href="`https://solscan.io/tx/${selectedToken.createTxSignature}`"
            target="_blank"
            rel="noopener noreferrer"
            class="px-4 py-2 bg-purple-600/90 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition"
          >
            View on Solscan →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { logout, changePassword, clearDatabase } from '../services/auth'
import { validateWallet, getCreatorWallets, addCreatorWallet, removeCreatorWallet, getWalletStats, type WalletStats, type Wallet } from '../services/wallets'
import { startStream, stopStream, getStreamStatus } from '../services/stream'
import { getCreatedTokens, type Token, type PaginationInfo } from '../services/tokens'
// Import SVG files as raw strings
import copyIconSvg from '../icons/copy.svg?raw'
import checkIconSvg from '../icons/check.svg?raw'
import trashIconSvg from '../icons/trash.svg?raw'
import searchIconSvg from '../icons/search.svg?raw'
import closeIconSvg from '../icons/close.svg?raw'
import manageBlacklistIconSvg from '../icons/manage-blacklist.svg?raw'
import clearDatabaseIconSvg from '../icons/clear-database.svg?raw'
import changePasswordIconSvg from '../icons/change-password.svg?raw'
import startTrackingIconSvg from '../icons/start-tracking.svg?raw'
import logoutIconSvg from '../icons/logout.svg?raw'

const router = useRouter()

// Helper function to process SVG for inline rendering
const processSvg = (svg: string, sizeClass: string = 'w-4 h-4') => {
  return svg.replace(
    '<svg',
    `<svg class="${sizeClass}" style="display: block;"`
  )
}

const wallets = ref<Wallet[]>([])
const walletNicknameInput = ref('')
const isTracking = ref(false)
const trackingLoading = ref(false)
const showManageDialog = ref(false)
const showChangePasswordDialog = ref(false)
const showClearDatabaseDialog = ref(false)
const clearDatabasePassword = ref('')
const clearingDatabase = ref(false)
const clearDatabaseError = ref('')
const walletAddressInput = ref('')
const walletAddressInputRef = ref<HTMLInputElement | null>(null)
const walletError = ref('')
const addingWallet = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')
const searchQuery = ref('')
const copiedAddress = ref<string | null>(null)
const selectedCreatorWallet = ref<string>('')
const tokens = ref<Token[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selectedToken = ref<Token | null>(null)
const chartRefs = ref<Map<string, HTMLCanvasElement>>(new Map())
const detailChartRef = ref<HTMLCanvasElement | null>(null)
const chartTooltip = ref({
  show: false,
  x: 0,
  y: 0,
  time: '',
  marketCap: 0,
  priceSol: 0,
  tradeType: 'buy' as 'buy' | 'sell'
})
const chartMetadata = ref<{
  timeSeries: any[]
  padding: { top: number; right: number; bottom: number; left: number }
  width: number
  height: number
  min: number
  max: number
  range: number
} | null>(null)
const copiedToken = ref<string | null>(null)
const itemsPerPage = ref<number | string>(20)
const walletStats = ref<WalletStats | null>(null)
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

// Filter wallets based on search query
const filteredWallets = computed(() => {
  if (!searchQuery.value.trim()) {
    return wallets.value
  }
  const query = searchQuery.value.toLowerCase().trim()
  return wallets.value.filter(wallet => 
    wallet.address.toLowerCase().includes(query) ||
    (wallet.nickname && wallet.nickname.toLowerCase().includes(query))
  )
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, pagination.value.page - Math.floor(maxVisible / 2))
  let end = Math.min(pagination.value.totalPages, start + maxVisible - 1)
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const passwordMismatch = computed(() => {
  return newPassword.value && confirmPassword.value && newPassword.value !== confirmPassword.value
})

const formatPriceSol = (value: number | null | undefined): string => {
  if (!value || value === 0) {
    return 'N/A'
  }
  
  // If the value is very small (< 0.000001), use scientific notation
  if (value < 0.000001) {
    return value.toExponential(6)
  }
  
  // For larger values, show up to 8 decimal places, removing trailing zeros
  const formatted = value.toFixed(8)
  return formatted.replace(/\.?0+$/, '')
}

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '0'
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K'
  return value.toFixed(2)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const formatAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

const formatWalletAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

const handleAddWallet = async () => {
  walletError.value = ''
  const address = walletAddressInput.value.trim()
  const nickname = walletNicknameInput.value.trim() || null
  
  if (!address) {
    walletError.value = 'Wallet address is required'
    return
  }
  
  if (wallets.value.some(w => w.address === address)) {
    walletError.value = 'This wallet address is already added'
    return
  }
  
  addingWallet.value = true
  
  try {
    const validation = await validateWallet(address)
    
    if (!validation.valid) {
      walletError.value = validation.error || 'Invalid wallet address'
      addingWallet.value = false
      return
    }
    
    const result = await addCreatorWallet(address, nickname)
    
    if (!result.success) {
      walletError.value = result.error || 'Failed to save wallet address'
      addingWallet.value = false
      return
    }
    
    wallets.value.unshift({ address, nickname })
    walletAddressInput.value = ''
    walletNicknameInput.value = ''
    walletError.value = ''
    addingWallet.value = false
  } catch (error) {
    walletError.value = 'Error adding wallet address. Please try again.'
    addingWallet.value = false
  }
}

const copyWalletAddress = async (address: string) => {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(address)
      copiedAddress.value = address
      setTimeout(() => {
        copiedAddress.value = null
      }, 2000)
      return
    }
    
    // Fallback for older browsers or insecure contexts
    const textArea = document.createElement('textarea')
    textArea.value = address
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    document.body.appendChild(textArea)
    textArea.select()
    textArea.setSelectionRange(0, address.length)
    
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        copiedAddress.value = address
        setTimeout(() => {
          copiedAddress.value = null
        }, 2000)
      } else {
        throw new Error('Copy command failed')
      }
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr)
      alert('Failed to copy address. Please copy manually.')
    } finally {
      document.body.removeChild(textArea)
    }
  } catch (error) {
    console.error('Failed to copy address:', error)
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = address
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      document.body.appendChild(textArea)
      textArea.select()
      textArea.setSelectionRange(0, address.length)
      
      const successful = document.execCommand('copy')
      if (successful) {
        copiedAddress.value = address
        setTimeout(() => {
          copiedAddress.value = null
        }, 2000)
      } else {
        alert('Failed to copy address. Please copy manually.')
      }
      document.body.removeChild(textArea)
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr)
      alert('Failed to copy address. Please copy manually.')
    }
  }
}

const removeWalletByAddress = async (address: string) => {
  try {
    const result = await removeCreatorWallet(address)
    
    if (!result.success) {
      alert(result.error || 'Failed to remove wallet address')
      return
    }
    
    const index = wallets.value.findIndex(w => w.address === address)
    if (index > -1) {
      wallets.value.splice(index, 1)
    }
    
    if (selectedCreatorWallet.value === address) {
      selectedCreatorWallet.value = ''
    }
    
    if (wallets.value.length === 0) {
      isTracking.value = false
    }
    
    loadTokens()
  } catch (error) {
    console.error('Error removing wallet:', error)
    alert('Error removing wallet address. Please try again.')
  }
}

const toggleTracking = async () => {
  if (wallets.value.length === 0 || trackingLoading.value) {
    return
  }

  trackingLoading.value = true
  
  try {
    if (isTracking.value) {
      await stopStream()
      isTracking.value = false
    } else {
      await startStream()
      isTracking.value = true
    }
  } catch (error: any) {
    console.error('Error toggling stream:', error)
    alert(error.message || 'Failed to toggle streaming')
  } finally {
    trackingLoading.value = false
  }
}

const closeManageDialog = () => {
  showManageDialog.value = false
  walletAddressInput.value = ''
  walletError.value = ''
  searchQuery.value = ''
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= pagination.value.totalPages) {
    pagination.value.page = page
    loadTokens()
  }
}

const handleFilterChange = async () => {
  pagination.value.page = 1
  await loadTokens()
  await loadWalletStats()
}

const handleItemsPerPageChange = () => {
  pagination.value.page = 1
  if (itemsPerPage.value === 'all') {
    pagination.value.limit = 1000000
  } else {
    pagination.value.limit = itemsPerPage.value as number
  }
  loadTokens()
}

const setChartRef = (mint: string, el: HTMLCanvasElement | null) => {
  if (el) {
    chartRefs.value.set(mint, el)
  }
}

const copyToClipboard = async (text: string) => {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      copiedToken.value = text
      setTimeout(() => {
        copiedToken.value = null
      }, 1000)
      return
    }
    
    // Fallback for older browsers or insecure contexts
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    document.body.appendChild(textArea)
    textArea.select()
    textArea.setSelectionRange(0, text.length)
    
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        copiedToken.value = text
        setTimeout(() => {
          copiedToken.value = null
        }, 1000)
      } else {
        throw new Error('Copy command failed')
      }
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr)
      alert('Failed to copy. Please copy manually.')
    } finally {
      document.body.removeChild(textArea)
    }
  } catch (err) {
    console.error('Failed to copy:', err)
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      document.body.appendChild(textArea)
      textArea.select()
      textArea.setSelectionRange(0, text.length)
      
      const successful = document.execCommand('copy')
      if (successful) {
        copiedToken.value = text
        setTimeout(() => {
          copiedToken.value = null
        }, 1000)
      } else {
        alert('Failed to copy. Please copy manually.')
      }
      document.body.removeChild(textArea)
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr)
      alert('Failed to copy. Please copy manually.')
    }
  }
}

const drawMiniChart = (canvas: HTMLCanvasElement, timeSeries: any[]) => {
  if (!timeSeries || timeSeries.length === 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width = canvas.offsetWidth
  const height = canvas.height = canvas.offsetHeight
  const padding = 2

  ctx.clearRect(0, 0, width, height)

  const values = timeSeries.map(d => d.marketCapUsd)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  ctx.strokeStyle = '#a855f7'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  timeSeries.forEach((point, index) => {
    const x = padding + (index / (timeSeries.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - ((point.marketCapUsd - min) / range) * (height - padding * 2)
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()
}

const drawDetailChart = (canvas: HTMLCanvasElement, timeSeries: any[]) => {
  if (!timeSeries || timeSeries.length === 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Ensure canvas has proper dimensions
  const containerWidth = canvas.offsetWidth || canvas.parentElement?.clientWidth || 800
  const width = canvas.width = containerWidth
  const height = canvas.height = 300
  
  // If width is still 0, retry after a short delay
  if (width === 0) {
    setTimeout(() => drawDetailChart(canvas, timeSeries), 100)
    return
  }
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }

  ctx.clearRect(0, 0, width, height)

  const values = timeSeries.map(d => d.marketCapUsd)
  const min = Math.min(...values) * 0.95
  const max = Math.max(...values) * 1.05
  const range = max - min || 1

  // Store chart metadata for tooltip calculations
  chartMetadata.value = {
    timeSeries,
    padding,
    width,
    height,
    min,
    max,
    range
  }

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (i / 5) * chartHeight
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  ctx.strokeStyle = '#a855f7'
  ctx.lineWidth = 3
  ctx.beginPath()

  timeSeries.forEach((point, index) => {
    const x = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
    const y = padding.top + chartHeight - ((point.marketCapUsd - min) / range) * chartHeight
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()

  ctx.fillStyle = '#a855f7'
  timeSeries.forEach((point, index) => {
    const x = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
    const y = padding.top + chartHeight - ((point.marketCapUsd - min) / range) * chartHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.fillStyle = '#9ca3af'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'right'
  
  for (let i = 0; i <= 5; i++) {
    const value = min + (max - min) * (1 - i / 5)
    const y = padding.top + (i / 5) * chartHeight
    ctx.fillText(formatCurrency(value), padding.left - 10, y + 4)
  }

  ctx.textAlign = 'center'
  const timeLabels = timeSeries.map((_, i) => {
    const time = timeSeries[i].timestamp - timeSeries[0].timestamp
    return `${(time / 1000).toFixed(1)}s`
  })
  
  timeSeries.forEach((_, index) => {
    if (index % Math.ceil(timeSeries.length / 5) === 0 || index === timeSeries.length - 1) {
      const x = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
      ctx.fillText(timeLabels[index], x, height - padding.bottom + 20)
    }
  })

  ctx.fillStyle = '#f3f4f6'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Market Cap (USD)', width / 2, 15)
}

const handleChartMouseMove = (event: MouseEvent) => {
  if (!detailChartRef.value || !chartMetadata.value) {
    chartTooltip.value.show = false
    return
  }

  const canvas = detailChartRef.value
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const { timeSeries, padding, width, height, min, range } = chartMetadata.value
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Find the closest point
  let closestIndex = -1
  let minDistance = Infinity
  const hitRadius = 12 // pixels

  timeSeries.forEach((point, index) => {
    const pointX = padding.left + (index / (timeSeries.length - 1 || 1)) * chartWidth
    const pointY = padding.top + chartHeight - ((point.marketCapUsd - min) / range) * chartHeight
    
    const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2))
    
    if (distance < minDistance && distance < hitRadius) {
      minDistance = distance
      closestIndex = index
    }
  })

  if (closestIndex >= 0) {
    const point = timeSeries[closestIndex]
    const pointX = padding.left + (closestIndex / (timeSeries.length - 1 || 1)) * chartWidth
    const pointY = padding.top + chartHeight - ((point.marketCapUsd - min) / range) * chartHeight
    
    // Calculate time relative to first point
    const timeSeconds = (point.timestamp - timeSeries[0].timestamp) / 1000
    
    // Get execution price - it exists in the data as executionPriceSol
    const executionPriceSol = point.executionPriceSol ?? 0
    
    // Position tooltip relative to the point, offset to avoid covering it
    let tooltipX = pointX + 15
    let tooltipY = pointY - 90 // Above the point
    
    // Ensure tooltip stays within container bounds
    const container = canvas.parentElement
    if (container) {
      const containerWidth = container.clientWidth
      
      // Adjust if tooltip would go off right edge
      if (tooltipX + 200 > containerWidth) {
        tooltipX = pointX - 215 // Show to the left instead
      }
      
      // Adjust if tooltip would go off top edge
      if (tooltipY < 0) {
        tooltipY = pointY + 20 // Show below the point instead
      }
    }
    
    chartTooltip.value = {
      show: true,
      x: tooltipX,
      y: tooltipY,
      time: `${timeSeconds.toFixed(1)}s`,
      marketCap: point.marketCapUsd,
      priceSol: executionPriceSol || 0,
      tradeType: point.tradeType || point.trade_type || 'buy'
    }
  } else {
    chartTooltip.value.show = false
  }
}

const handleChartMouseLeave = () => {
  chartTooltip.value.show = false
}

watch(selectedToken, async (newToken) => {
  if (newToken && newToken.marketCapTimeSeries && newToken.marketCapTimeSeries.length > 0) {
    // Wait for the modal to be fully rendered
    await nextTick()
    
    // Use requestAnimationFrame to ensure DOM is fully laid out
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Try to get the canvas element, with retries if needed
        let retries = 0
        const maxRetries = 20
        
        const tryDrawChart = () => {
          if (detailChartRef.value) {
            const canvas = detailChartRef.value
            // Check if canvas has dimensions
            if (canvas.offsetWidth > 0) {
              drawDetailChart(canvas, newToken.marketCapTimeSeries)
            } else if (retries < maxRetries) {
              retries++
              setTimeout(tryDrawChart, 50)
            }
          } else if (retries < maxRetries) {
            retries++
            setTimeout(tryDrawChart, 50)
          }
        }
        
        tryDrawChart()
      })
    })
  } else {
    // Clear tooltip when token is deselected
    chartTooltip.value.show = false
    chartMetadata.value = null
  }
})

watch(tokens, async () => {
  await nextTick()
  tokens.value.forEach(token => {
    const canvas = chartRefs.value.get(token.mint)
    if (canvas && token.marketCapTimeSeries && token.marketCapTimeSeries.length > 0) {
      drawMiniChart(canvas, token.marketCapTimeSeries)
    }
  })
}, { deep: true })

const loadWalletStats = async () => {
  if (!selectedCreatorWallet.value) {
    walletStats.value = null
    return
  }

  try {
    walletStats.value = await getWalletStats(selectedCreatorWallet.value)
  } catch (err: any) {
    console.error('Error loading wallet statistics:', err)
    walletStats.value = null
  }
}

const loadTokens = async () => {
  loading.value = true
  error.value = null
  
  try {
    const limit = itemsPerPage.value === 'all' ? 1000000 : (itemsPerPage.value as number)
    // When "All Wallets" is selected (empty string), show all tokens without filtering
    // When a specific wallet is selected, filter by that wallet
    const viewAll = !selectedCreatorWallet.value
    const response = await getCreatedTokens(
      pagination.value.page,
      limit,
      selectedCreatorWallet.value || undefined,
      viewAll
    )
    tokens.value = response.tokens
    pagination.value = response.pagination
  } catch (err: any) {
    error.value = err.message || 'Failed to load tokens'
    console.error('Error loading tokens:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    wallets.value = await getCreatorWallets()
    
    const response = await getStreamStatus()
    isTracking.value = response.status || false
    
    await loadTokens()
  } catch (error) {
    console.error('Error loading data:', error)
  }
})

onUnmounted(async () => {
  if (isTracking.value) {
    try {
      await stopStream()
    } catch (error) {
      console.error('Error stopping stream on unmount:', error)
    }
  }
})

watch(showManageDialog, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    walletAddressInputRef.value?.focus()
  }
})

const closeChangePasswordDialog = () => {
  showChangePasswordDialog.value = false
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
}

const handleChangePassword = async () => {
  if (passwordMismatch.value) {
    passwordError.value = 'Passwords do not match'
    return
  }

  if (newPassword.value.length < 6) {
    passwordError.value = 'New password must be at least 6 characters long'
    return
  }

  changingPassword.value = true
  passwordError.value = ''
  passwordSuccess.value = ''

  try {
    const result = await changePassword(currentPassword.value, newPassword.value)
    
    if (result.success) {
      passwordSuccess.value = result.message || 'Password changed successfully'
      // Clear form after 2 seconds and close dialog
      setTimeout(() => {
        closeChangePasswordDialog()
      }, 2000)
    } else {
      passwordError.value = result.error || 'Failed to change password'
    }
  } catch (error) {
    passwordError.value = 'An unexpected error occurred'
  } finally {
    changingPassword.value = false
  }
}

const handleLogout = async () => {
  await logout()
  router.push('/login')
}

const closeClearDatabaseDialog = () => {
  showClearDatabaseDialog.value = false
  clearDatabasePassword.value = ''
  clearDatabaseError.value = ''
}

const handleClearDatabase = async () => {
  if (!clearDatabasePassword.value) {
    clearDatabaseError.value = 'Password is required'
    return
  }

  clearingDatabase.value = true
  clearDatabaseError.value = ''

  try {
    const result = await clearDatabase(clearDatabasePassword.value)
    
    if (result.success) {
      // Clear all local state
      wallets.value = []
      tokens.value = []
      selectedCreatorWallet.value = ''
      walletStats.value = null
      pagination.value = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
      
      // Close dialog and show success
      closeClearDatabaseDialog()
      alert('Database cleared successfully!')
      
      // Reload tokens to show empty state
      await loadTokens()
    } else {
      clearDatabaseError.value = result.error || 'Failed to clear database'
    }
  } catch (error) {
    clearDatabaseError.value = 'An unexpected error occurred'
  } finally {
    clearingDatabase.value = false
  }
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

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.5) rgba(31, 41, 55, 0.5);
}

.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.7);
}

table {
  border-collapse: separate;
  border-spacing: 0;
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>
