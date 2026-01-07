<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Navbar - Only show when not on login page -->
    <nav v-if="route.path !== '/login'" class="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
      <div class="w-[90%] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              SolTrack
            </h1>
            <p class="text-gray-400 text-xs mt-0.5">Multi-Server Analytics Platform</p>
          </div>
          <div class="flex items-center gap-2">
            <router-link
              to="/creator-wallets"
              class="px-4 py-2 text-sm font-semibold rounded transition"
              :class="$route.path.startsWith('/creator-wallets') 
                ? 'bg-purple-600/90 text-white' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'"
            >
              Creator Wallet Tracker
            </router-link>
            <router-link
              to="/trading-wallets"
              class="px-4 py-2 text-sm font-semibold rounded transition"
              :class="$route.path.startsWith('/trading-wallets') 
                ? 'bg-purple-600/90 text-white' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'"
            >
              Trading Wallet Tracker
            </router-link>
          </div>
        </div>
      </div>
    </nav>
    
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

