<template>
  <div style="margin-bottom: 10px; padding: 8px; background: #1a1f2e; border: 1px solid #334155; border-radius: 4px;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <label style="font-weight: 600; color: #cbd5e1; font-size: 0.8rem;">
        {{ filterLabel }}
      </label>
      <button
        @click="$emit('remove')"
        style="padding: 3px 10px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.75rem; transition: all 0.2s;"
        @mouseenter="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#dc2626' }"
        @mouseleave="(e) => { const target = e.currentTarget as HTMLElement; if (target) target.style.background = '#ef4444' }"
      >
        Remove
      </button>
    </div>

    <!-- Sell Number Selector (for sell filters) -->
    <div v-if="isSellFilter" style="margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
      <label style="color: #94a3b8; font-size: 0.75rem;">Sell Number:</label>
      <select
        :value="filter.sellNumber || 1"
        @change="updateSellNumber"
        style="padding: 4px 8px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 4px; font-size: 0.75rem; cursor: pointer;"
      >
        <option v-for="i in maxSellOptions" :key="i" :value="i">
          {{ i === 1 ? '1st sell' : i === 2 ? '2nd sell' : i === 3 ? '3rd sell' : `${i}th sell` }}
        </option>
      </select>
    </div>

    <!-- Timestamp Filter -->
    <div v-if="filterType === 'timestamp'" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
      <label style="color: #94a3b8; font-size: 0.75rem; white-space: nowrap;">From:</label>
      <input
        :value="minDateTimeLocal"
        @change="updateTimestampMin"
        type="datetime-local"
        style="padding: 6px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 4px; font-size: 0.75rem; min-width: 160px;"
      >
      <label style="color: #94a3b8; font-size: 0.75rem; white-space: nowrap; margin-left: 6px;">To:</label>
      <input
        :value="maxDateTimeLocal"
        @change="updateTimestampMax"
        type="datetime-local"
        style="padding: 6px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 4px; font-size: 0.75rem; min-width: 160px;"
      >
    </div>

    <!-- Numeric Filter -->
    <div v-else style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
      <input
        :id="`filter-${filter.id}-min`"
        :value="filter.min"
        @input="updateMin"
        type="number"
        :min="filterType === 'percent' || filterType === 'sol' ? undefined : config.min"
        :step="config.step"
        :placeholder="filterType === 'percent' || filterType === 'sol' ? 'Min' : config.min.toString()"
        style="flex: 1; min-width: 100px; padding: 6px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 4px; font-size: 0.75rem;"
      >
      <span style="color: #94a3b8; font-size: 0.75rem;">to</span>
      <input
        :id="`filter-${filter.id}-max`"
        :value="filter.max"
        @input="updateMax"
        type="number"
        :min="filterType === 'sol' || filterType === 'token' || filterType === 'marketcap' ? config.min : undefined"
        :step="config.step"
        placeholder="Max"
        style="flex: 1; min-width: 100px; padding: 6px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 4px; font-size: 0.75rem;"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  filter: any
  dataPoint: any
  maxSells?: number
}>()

const emit = defineEmits<{
  (e: 'update:filter', filter: any): void
  (e: 'remove'): void
}>()

const config = computed(() => getFilterConfig(props.filter.type))
const filterType = computed(() => props.filter.type)
const isSellFilter = computed(() => props.dataPoint?.isArray && props.dataPoint?.field === 'sells')
const maxSellOptions = computed(() => Math.max(props.maxSells || 10, 10))

const filterLabel = computed(() => {
  let label = props.filter.label
  if (isSellFilter.value && props.filter.sellNumber) {
    const sellNumText = props.filter.sellNumber === 1 ? '1st' : props.filter.sellNumber === 2 ? '2nd' : props.filter.sellNumber === 3 ? '3rd' : `${props.filter.sellNumber}th`
    label = `${props.filter.label} (${sellNumText} sell)`
  }
  return label
})


const minDateTimeLocal = computed(() => {
  if (!props.filter.min) return ''
  try {
    const date = new Date(props.filter.min)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
})

const maxDateTimeLocal = computed(() => {
  if (!props.filter.max) return ''
  try {
    const date = new Date(props.filter.max)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
})

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
    default:
      return { min: 0, max: 100, defaultMin: 0, defaultMax: 100, step: 0.01 }
  }
}

function updateMin(e: Event) {
  const input = e.target as HTMLInputElement
  const val = input.value === '' ? null : parseFloat(input.value)
  
  if (isNaN(val as number) && val !== null) return
  
  const updatedFilter = { ...props.filter, min: val }
  if (val !== null && val > (props.filter.max ?? config.value.max)) {
    updatedFilter.max = val
  }
  emit('update:filter', updatedFilter)
}

function updateMax(e: Event) {
  const input = e.target as HTMLInputElement
  const val = input.value === '' ? null : parseFloat(input.value)
  
  if (isNaN(val as number) && val !== null) return
  
  const updatedFilter = { ...props.filter, max: val }
  if (val !== null && val < (props.filter.min ?? config.value.min)) {
    updatedFilter.min = val
  }
  emit('update:filter', updatedFilter)
}

function updateSellNumber(e: Event) {
  const select = e.target as HTMLSelectElement
  const newSellNumber = parseInt(select.value)
  emit('update:filter', { ...props.filter, sellNumber: newSellNumber })
}

function updateTimestampMin(e: Event) {
  const input = e.target as HTMLInputElement
  const updatedFilter = { ...props.filter }
  if (input.value) {
    const date = new Date(input.value)
    updatedFilter.min = date.toISOString()
  } else {
    updatedFilter.min = null
  }
  emit('update:filter', updatedFilter)
}

function updateTimestampMax(e: Event) {
  const input = e.target as HTMLInputElement
  const updatedFilter = { ...props.filter }
  if (input.value) {
    const date = new Date(input.value)
    updatedFilter.max = date.toISOString()
  } else {
    updatedFilter.max = null
  }
  emit('update:filter', updatedFilter)
}

</script>

<style scoped>
</style>
