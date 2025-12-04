import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import MainBoard from '../views/MainBoard.vue'
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
      path: '/board',
      name: 'MainBoard',
      component: MainBoard,
      meta: { requiresAuth: true }
    }
  ]
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const isAuthenticated = await checkAuth()

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next('/board')
  } else {
    next()
  }
})

export default router

