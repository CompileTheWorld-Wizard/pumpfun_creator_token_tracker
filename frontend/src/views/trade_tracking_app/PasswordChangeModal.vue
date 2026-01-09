<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-lg font-bold text-gray-100">🔑 Change Password</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-200 text-xl leading-none"
        >
          ×
        </button>
      </div>
      
      <form @submit.prevent="handleChangePassword" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1">Current Password</label>
          <input
            v-model="currentPassword"
            type="password"
            required
            class="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter current password"
          />
        </div>
        
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1">New Password</label>
          <input
            v-model="newPassword"
            type="password"
            required
            class="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter new password"
          />
          <p class="text-xs text-gray-500 mt-0.5">
            Requirements: At least 6 characters, one uppercase letter, one number
          </p>
        </div>
        
        <div>
          <label class="block text-xs font-semibold text-gray-300 mb-1">Confirm New Password</label>
          <input
            v-model="confirmPassword"
            type="password"
            required
            class="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm new password"
          />
        </div>
        
        <div v-if="error" class="bg-red-950/50 border border-red-800 text-red-300 px-2 py-1.5 rounded text-xs">
          {{ error }}
        </div>
        
        <div v-if="success" class="bg-green-950/50 border border-green-800 text-green-300 px-2 py-1.5 rounded text-xs">
          {{ success }}
        </div>
        
        <div class="flex gap-1.5 justify-end">
          <button
            type="button"
            @click="$emit('close')"
            class="px-3 py-1.5 bg-gray-800 text-gray-200 rounded font-semibold text-xs hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-semibold text-xs hover:from-green-500 hover:to-green-600 transition disabled:opacity-50"
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
