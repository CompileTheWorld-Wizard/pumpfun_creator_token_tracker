<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal" style="max-width: 900px; max-height: 90vh;">
      <div class="modal-header">
        <h2>📊 Trading Activity Over Time</h2>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body" style="overflow-y: auto;">
        <div style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <label style="color: #cbd5e1; font-size: 0.9rem; font-weight: 600;">Time Interval:</label>
          <select
            v-model="interval"
            @change="updateChart"
            style="padding: 8px 12px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.9rem; cursor: pointer;"
          >
            <option value="hour">Hourly</option>
            <option value="quarter_day">Quarter Daily (Morning/Afternoon/Evening/Night)</option>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <label style="color: #cbd5e1; font-size: 0.9rem; font-weight: 600;">Chart Type:</label>
          <select
            v-model="chartType"
            @change="updateChart"
            style="padding: 8px 12px; border: 1px solid #334155; background: #0f1419; color: #e0e7ff; border-radius: 6px; font-size: 0.9rem; cursor: pointer;"
          >
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
          </select>
        </div>
        <div v-if="loading" style="text-align: center; padding: 40px; color: #94a3b8;">
          Loading chart data...
        </div>
        <div v-else-if="error" style="text-align: center; padding: 20px; color: #ef4444;">
          {{ error }}
        </div>
        <div v-else style="position: relative; height: 400px; margin-bottom: 20px;">
          <canvas ref="chartCanvas"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { fetchWalletActivity } from '../../services/tradeTracking'

Chart.register(...registerables)

interface ActivityDataItem {
  period: string
  buys: number
  sells: number
  total: number
  pnlPercent?: number
  pnlSOL?: number
}

const props = defineProps<{
  show: boolean
  walletAddress: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const interval = ref('day')
const chartType = ref<'line' | 'bar'>('line')
const loading = ref(false)
const error = ref('')
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const close = () => {
  emit('close')
}

const formatLabel = (period: string, intervalType: string): string => {
  if (!period) return ''
  
  let periodStr = String(period)
  
  if (periodStr.includes('GMT') || periodStr.includes('UTC') || periodStr.includes('T')) {
    try {
      const date = new Date(periodStr)
      if (!isNaN(date.getTime())) {
        switch (intervalType) {
          case 'hour':
            const hour = String(date.getUTCHours()).padStart(2, '0')
            const minute = String(date.getUTCMinutes()).padStart(2, '0')
            const year = date.getUTCFullYear()
            const month = String(date.getUTCMonth() + 1).padStart(2, '0')
            const day = String(date.getUTCDate()).padStart(2, '0')
            periodStr = `${year}-${month}-${day} ${hour}:${minute}`
            break
          case 'day':
            const dYear = date.getUTCFullYear()
            const dMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
            const dDay = String(date.getUTCDate()).padStart(2, '0')
            periodStr = `${dYear}-${dMonth}-${dDay}`
            break
          case 'month':
            const mYear = date.getUTCFullYear()
            const mMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
            periodStr = `${mYear}-${mMonth}`
            break
        }
      }
    } catch (e) {
      // Use string as is
    }
  }
  
  switch (intervalType) {
    case 'hour':
      if (periodStr.includes(' ')) {
        const [date, time] = periodStr.split(' ')
        const dateParts = date.split('-')
        if (dateParts.length >= 3) {
          return `${dateParts[1]}/${dateParts[2]} ${time}`
        }
      }
      return periodStr
      
    case 'quarter_day':
      if (periodStr.includes(' ')) {
        const parts = periodStr.split(' ')
        if (parts.length >= 2) {
          const dateParts = parts[0].split('-')
          if (dateParts.length >= 3) {
            const timeOfDay = parts.slice(1).join(' ')
            return `${dateParts[1]}/${dateParts[2]} ${timeOfDay}`
          }
        }
      }
      return periodStr
      
    case 'day':
      if (periodStr.includes('-')) {
        const dateParts = periodStr.split('-')
        if (dateParts.length >= 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
          return `${dateParts[1]}/${dateParts[2]}`
        }
      }
      return periodStr
      
    case 'week':
      if (periodStr.includes('-W')) {
        const [year, week] = periodStr.split('-W')
        if (year && week) {
          return `W${week} ${year}`
        }
      }
      return periodStr
      
    case 'month':
      if (periodStr.includes('-')) {
        const parts = periodStr.split('-')
        if (parts.length >= 2 && parts[0] && parts[1]) {
          const year = parts[0]
          const month = parts[1]
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthIndex = parseInt(month) - 1
          if (monthIndex >= 0 && monthIndex < 12) {
            return `${monthNames[monthIndex]} ${year}`
          }
        }
      }
      return periodStr
      
    default:
      return periodStr
  }
}

const updateChart = async () => {
  if (!props.walletAddress || !chartCanvas.value) return
  
  loading.value = true
  error.value = ''
  
  if (chart) {
    chart.destroy()
    chart = null
  }
  
  try {
    const result = await fetchWalletActivity(props.walletAddress, interval.value)
    
    if (!result.success || !result.data || result.data.length === 0) {
      error.value = 'No trading activity data available for this wallet'
      loading.value = false
      return
    }
    
    const labels = result.data.map((item: ActivityDataItem) => formatLabel(item.period, interval.value))
    const buysData = result.data.map((item: ActivityDataItem) => item.buys)
    const sellsData = result.data.map((item: ActivityDataItem) => item.sells)
    const totalData = result.data.map((item: ActivityDataItem) => item.total)
    const pnlPercentData = result.data.map((item: ActivityDataItem) => item.pnlPercent || 0)
    const pnlSOLData = result.data.map((item: ActivityDataItem) => item.pnlSOL || 0)
    
    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) return
    
    chart = new Chart(ctx, {
      type: chartType.value,
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Buys',
            data: buysData,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: chartType.value === 'bar' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.1)',
            tension: 0.1,
            fill: chartType.value === 'line',
            yAxisID: 'y'
          },
          {
            label: 'Sells',
            data: sellsData,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: chartType.value === 'bar' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.1)',
            tension: 0.1,
            fill: chartType.value === 'line',
            yAxisID: 'y'
          },
          {
            label: 'Total',
            data: totalData,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: chartType.value === 'bar' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.1)',
            tension: 0.1,
            fill: chartType.value === 'line',
            yAxisID: 'y'
          },
          {
            label: 'PNL %',
            data: pnlPercentData,
            borderColor: 'rgb(168, 85, 247)',
            backgroundColor: chartType.value === 'bar' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(168, 85, 247, 0.1)',
            tension: 0.1,
            fill: chartType.value === 'line',
            yAxisID: 'y1',
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#e0e7ff',
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(15, 20, 25, 0.9)',
            titleColor: '#e0e7ff',
            bodyColor: '#e0e7ff',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || ''
                if (label) {
                  label += ': '
                }
                if (context.datasetIndex === 3) { // PNL % dataset
                  const dataIndex = context.dataIndex
                  const pnlPercent = pnlPercentData[dataIndex]
                  const pnlSOL = pnlSOLData[dataIndex]
                  const sign = pnlSOL >= 0 ? '+' : ''
                  label += `${pnlPercent.toFixed(2)}% (${sign}${pnlSOL.toFixed(4)} SOL)`
                } else {
                  label += context.parsed.y
                }
                return label
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
              maxRotation: interval.value === 'hour' || interval.value === 'quarter_day' ? 45 : 0,
              minRotation: 0,
              maxTicksLimit: interval.value === 'hour' ? 24 : interval.value === 'day' ? 14 : interval.value === 'week' ? 12 : interval.value === 'month' ? 12 : 20
            },
            grid: {
              color: '#334155'
            }
          },
          y: {
            beginAtZero: true,
            position: 'left',
            ticks: {
              color: '#94a3b8',
              stepSize: 1
            },
            grid: {
              color: '#334155'
            },
            title: {
              display: true,
              text: 'Transaction Count',
              color: '#94a3b8'
            }
          },
          y1: {
            beginAtZero: false,
            position: 'right',
            ticks: {
              color: '#a855f7',
              callback: function(value) {
                const numValue = typeof value === 'string' ? parseFloat(value) : value
                return numValue.toFixed(2) + '%'
              }
            },
            grid: {
              drawOnChartArea: false,
              color: '#334155'
            },
            title: {
              display: true,
              text: 'PNL %',
              color: '#a855f7'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    })
    
    loading.value = false
  } catch (err: any) {
    console.error('Error loading activity chart:', err)
    error.value = 'Error loading chart data: ' + (err.message || 'Unknown error')
    loading.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal && props.walletAddress) {
    nextTick(() => {
      updateChart()
    })
  } else {
    if (chart) {
      chart.destroy()
      chart = null
    }
  }
})

onUnmounted(() => {
  if (chart) {
    chart.destroy()
    chart = null
  }
})
</script>

<style scoped>
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
