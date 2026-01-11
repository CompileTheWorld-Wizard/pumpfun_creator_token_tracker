import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import MainBoard from '../views/creator_tracking_app/MainBoard.vue'
import Settings from '../views/creator_tracking_app/Settings.vue'
import TradeTracking from '../views/trade_tracking_app/TradeTracking.vue'
import FundTracking from '../views/fund_tracking_app/FundTracking.vue'
import { checkAuth } from '../services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { requiresGuest: true }
    },
    {
      path: '/creator-wallets',
      name: 'CreatorWallets',
      component: MainBoard,
      meta: { requiresAuth: true }
    },
    {
      path: '/creator-wallets/settings',
      name: 'CreatorWalletsSettings',
      component: Settings,
      meta: { requiresAuth: true }
    },
    {
      path: '/trading-wallets',
      redirect: '/trade-tracking'
    },
    {
      path: '/trade-tracking',
      name: 'TradeTracking',
      component: TradeTracking,
      meta: { requiresAuth: true }
    },
    {
      path: '/fund-tracking',
      name: 'FundTracking',
      component: FundTracking,
      meta: { requiresAuth: true }
    },
    // Legacy routes for backward compatibility
    {
      path: '/board',
      redirect: '/creator-wallets'
    },
    {
      path: '/settings',
      redirect: '/creator-wallets/settings'
    }
  ]
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const isAuthenticated = await checkAuth()

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next('/creator-wallets')
  } else {
    next()
  }
})

export default router

