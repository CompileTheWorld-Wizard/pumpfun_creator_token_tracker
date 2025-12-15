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
          <div class="flex items-center gap-2">
            <button
              @click="showManageDialog = true"
              class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-gray-500/50 flex items-center gap-1.5"
            >
              <span class="w-3.5 h-3.5 inline-flex items-center justify-center" v-html="processSvg(manageBlacklistIconSvg)"></span>
              Manage Blacklist
              <span v-if="wallets.length > 0" class="px-1 py-0.5 bg-red-600/80 text-white text-xs font-bold rounded-full">
                {{ wallets.length }}
              </span>
            </button>
            <button
              @click="showClearDatabaseDialog = true"
              class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-red-500/50 flex items-center gap-1.5"
            >
              <span class="w-3.5 h-3.5 inline-flex items-center justify-center" v-html="processSvg(clearDatabaseIconSvg)"></span>
              Clear Database
            </button>
            <button
              @click="showChangePasswordDialog = true"
              class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-gray-500/50 flex items-center gap-1.5"
            >
              <span class="w-3.5 h-3.5 inline-flex items-center justify-center" v-html="processSvg(changePasswordIconSvg)"></span>
              Change Password
            </button>
            <button
              @click="toggleTracking"
              :disabled="trackingLoading"
              :class="[
                'px-3 py-1.5 text-xs font-semibold rounded transition focus:outline-none focus:ring-2 flex items-center gap-1.5',
                isTracking || trackingLoading
                  ? 'bg-red-600/90 hover:bg-red-600 text-white focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-green-600/90 hover:bg-green-600 text-white focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed'
              ]"
            >
              <div v-if="trackingLoading" class="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
              <span v-if="!trackingLoading" class="w-3.5 h-3.5 inline-flex items-center justify-center" v-html="processSvg(startTrackingIconSvg)"></span>
              <span v-if="trackingLoading">Finalizing...</span>
              <span v-else-if="isTracking">Stop Tracking</span>
              <span v-else>Start Tracking</span>
            </button>
            <button
              @click="$router.push('/settings')"
              class="px-3 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Settings
            </button>
            <button
              @click="handleLogout"
              class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-red-500/50 flex items-center gap-1.5"
            >
              <span class="w-3.5 h-3.5 inline-flex items-center justify-center" v-html="processSvg(logoutIconSvg)"></span>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Wallets</h3>
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
          </div>
          <p class="text-2xl font-bold text-purple-400">{{ totalWalletsCount }}</p>
          <p class="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
        
        <div class="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 p-3 rounded-lg backdrop-blur-sm">
          <div class="flex items-center justify-between mb-1.5">
            <h3 class="text-xs font-semibold text-gray-400">Tokens</h3>
            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p class="text-2xl font-bold text-blue-400">{{ tokensTotalCount }}</p>
          <p class="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
      </div>

      <!-- Tab Controller -->
      <div class="mb-4">
        <div class="flex border-b border-gray-800">
          <button
            @click="activeTab = 'creator-wallets'"
            :class="[
              'px-4 py-2 text-sm font-semibold transition',
              activeTab === 'creator-wallets'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            ]"
          >
            Creator Wallets
          </button>
          <button
            @click="activeTab = 'tokens'"
            :class="[
              'px-4 py-2 text-sm font-semibold transition',
              activeTab === 'tokens'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            ]"
          >
            Tokens
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <CreatorWalletsTab v-if="activeTab === 'creator-wallets'" />
      <TokensTab v-else @select-token="selectedToken = $event" @update-total="tokensTotalCount = $event" />
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
import { validateWallet, getCreatorWallets, addCreatorWallet, removeCreatorWallet, type Wallet } from '../services/wallets'
import { startStream, stopStream, getStreamStatus } from '../services/stream'
import { getCreatorWalletsFromTokens, type Token } from '../services/tokens'
import CreatorWalletsTab from './CreatorWalletsTab.vue'
import TokensTab from './TokensTab.vue'
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

const activeTab = ref<'creator-wallets' | 'tokens'>('creator-wallets')
const tokensTotalCount = ref<number>(0)

// Helper function to process SVG for inline rendering
const processSvg = (svg: string, sizeClass: string = 'w-4 h-4') => {
  return svg.replace(
    '<svg',
    `<svg class="${sizeClass}" style="display: block;"`
  )
}

const wallets = ref<Wallet[]>([])
const creatorWallets = ref<string[]>([]) // Creator wallets from tbl_soltrack_created_tokens (for filter)
const totalWalletsCount = ref<number>(0) // Total unique creator wallets from tokens
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
const selectedToken = ref<Token | null>(null)
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
    // Reload creator wallets to update total count
    await loadCreatorWallets()
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
    
    // Reload creator wallets to update total count
    await loadCreatorWallets()
  } catch (error) {
    console.error('Error removing wallet:', error)
    alert('Error removing wallet address. Please try again.')
  }
}

const toggleTracking = async () => {
  if (trackingLoading.value) {
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

const loadCreatorWallets = async () => {
  try {
    creatorWallets.value = await getCreatorWalletsFromTokens(true)
    totalWalletsCount.value = creatorWallets.value.length
    // Note: tokensTotalCount will be updated by TokensTab component via emit or we can fetch it separately
  } catch (err: any) {
    console.error('Error loading creator wallets:', err)
    creatorWallets.value = []
    totalWalletsCount.value = 0
  }
}

// Watch for token selection from TokensTab
watch(selectedToken, async (newToken) => {
  if (newToken && newToken.marketCapTimeSeries && newToken.marketCapTimeSeries.length > 0) {
    await nextTick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        let retries = 0
        const maxRetries = 20
        
        const tryDrawChart = () => {
          if (detailChartRef.value) {
            const canvas = detailChartRef.value
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
    chartTooltip.value.show = false
    chartMetadata.value = null
  }
})

onMounted(async () => {
  try {
    wallets.value = await getCreatorWallets()
    
    const response = await getStreamStatus()
    isTracking.value = response.status || false
    
    await loadCreatorWallets()
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
      tokensTotalCount.value = 0
      totalWalletsCount.value = 0
      
      // Close dialog and show success
      closeClearDatabaseDialog()
      alert('Database cleared successfully!')
      
      // Reload data
      await loadCreatorWallets()
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
