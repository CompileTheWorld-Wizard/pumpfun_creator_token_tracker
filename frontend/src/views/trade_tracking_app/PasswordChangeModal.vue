<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gray-100">🔑 Change Password</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-200 text-2xl leading-none"
        >
          ×
        </button>
      </div>
      
      <form @submit.prevent="handleChangePassword" class="space-y-4">
        <div>
          <label class="block text-sm font-semibold text-gray-300 mb-1">Current Password</label>
          <input
            v-model="currentPassword"
            type="password"
            required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter current password"
          />
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-300 mb-1">New Password</label>
          <input
            v-model="newPassword"
            type="password"
            required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter new password"
          />
          <p class="text-xs text-gray-500 mt-1">
            Requirements: At least 6 characters, one uppercase letter, one number
          </p>
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-300 mb-1">Confirm New Password</label>
          <input
            v-model="confirmPassword"
            type="password"
            required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm new password"
          />
        </div>
        
        <div v-if="error" class="bg-red-950/50 border border-red-800 text-red-300 px-3 py-2 rounded text-sm">
          {{ error }}
        </div>
        
        <div v-if="success" class="bg-green-950/50 border border-green-800 text-green-300 px-3 py-2 rounded text-sm">
          {{ success }}
        </div>
        
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 bg-gray-800 text-gray-200 rounded font-semibold text-sm hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-semibold text-sm hover:from-green-500 hover:to-green-600 transition disabled:opacity-50"
          >
            {{ loading ? 'Changing...' : 'Change Password' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { changePassword } from '../../services/auth'

defineEmits<{
  (e: 'close'): void
}>()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const handleChangePassword = async () => {
  error.value = ''
  success.value = ''
  
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  
  if (newPassword.value.length < 6) {
    error.value = 'New password must be at least 6 characters long'
    return
  }
  
  loading.value = true
  try {
    const result = await changePassword(currentPassword.value, newPassword.value)
    
    if (result.success) {
      success.value = result.message || 'Password changed successfully'
      setTimeout(() => {
        currentPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
        success.value = ''
      }, 2000)
    } else {
      error.value = result.error || 'Failed to change password'
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}
</script>
