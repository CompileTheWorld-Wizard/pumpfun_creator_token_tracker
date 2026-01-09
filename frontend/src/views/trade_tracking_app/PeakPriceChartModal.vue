<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal" style="max-width: 900px; max-height: 90vh;">
      <div class="modal-header">
        <h2>📈 Token Peak Market Cap Chart</h2>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body" style="overflow-y: auto;">
        <div style="margin-bottom: 10px; color: #94a3b8; font-size: 0.75rem;">
          This chart shows peak market caps for tokens with first sell: peak market cap before 1st sell, 1st sell market cap, and peak market cap 10s after 1st sell. Dots are grouped by type. Average values are shown in the legend and as dashed lines on the chart.
        </div>
        <div v-if="loading" style="text-align: center; padding: 40px; color: #94a3b8;">
          Loading chart data...
        </div>
        <div v-else-if="error" style="text-align: center; padding: 20px; color: #ef4444;">
          {{ error }}
        </div>
        <div v-else style="position: relative; height: 500px; margin-bottom: 20px;">
          <canvas ref="chartCanvas"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { fetchDashboardData } from '../../services/tradeTracking'

Chart.register(...registerables)

const props = defineProps<{
  show: boolean
  walletAddress: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)
const error = ref('')
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const close = () => {
  emit('close')
}

const formatMarketCap = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A'
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
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
    const result = await fetchDashboardData(props.walletAddress, 1, 1000, [])
    
    if (!result.success || !result.data || result.data.length === 0) {
      error.value = 'No token data available for this wallet'
      loading.value = false
      return
    }
    
    const dataPoints: any[] = []
    
    result.data.forEach((token: any, index: number) => {
      if (!token.sells || token.sells.length === 0) {
        return
      }
      
      const firstSell = token.sells[0]
      const tokenLabel = token.tokenSymbol || token.tokenName || `Token ${index + 1}`
      
      // Parse values to ensure they're numbers
      const peakMarketCapBeforeSell = token.tokenPeakMarketCapBeforeFirstSell != null 
        ? (typeof token.tokenPeakMarketCapBeforeFirstSell === 'string' 
            ? parseFloat(token.tokenPeakMarketCapBeforeFirstSell) 
            : token.tokenPeakMarketCapBeforeFirstSell)
        : null
      const firstSellMarketCap = firstSell?.marketCap != null
        ? (typeof firstSell.marketCap === 'string'
            ? parseFloat(firstSell.marketCap)
            : firstSell.marketCap)
        : null
      const peakMarketCapAfterSell = token.tokenPeakMarketCap10sAfterFirstSell != null
        ? (typeof token.tokenPeakMarketCap10sAfterFirstSell === 'string'
            ? parseFloat(token.tokenPeakMarketCap10sAfterFirstSell)
            : token.tokenPeakMarketCap10sAfterFirstSell)
        : null
      
      // Include token if at least one market cap value exists (including 0)
      if (peakMarketCapBeforeSell != null || firstSellMarketCap != null || peakMarketCapAfterSell != null) {
        dataPoints.push({
          token: tokenLabel,
          tokenAddress: token.tokenAddress,
          peakMarketCapBeforeSell: peakMarketCapBeforeSell,
          firstSellMarketCap: firstSellMarketCap,
          peakMarketCapAfterSell: peakMarketCapAfterSell
        })
      }
    })
    
    if (dataPoints.length === 0) {
      error.value = 'No peak market cap data available for tokens with first sell'
      loading.value = false
      return
    }
    
    const addJitter = () => (Math.random() - 0.5) * 0.3
    
    const peakBeforeData: any[] = []
    const firstSellData: any[] = []
    const peakAfterData: any[] = []
    
    let peakBeforeSum = 0
    let peakBeforeCount = 0
    let firstSellSum = 0
    let firstSellCount = 0
    let peakAfterSum = 0
    let peakAfterCount = 0
    
    dataPoints.forEach((dp) => {
      if (dp.peakMarketCapBeforeSell != null && typeof dp.peakMarketCapBeforeSell === 'number') {
        peakBeforeData.push({ 
          x: 0 + addJitter(), 
          y: dp.peakMarketCapBeforeSell,
          token: dp.token,
          tokenAddress: dp.tokenAddress
        })
        peakBeforeSum += dp.peakMarketCapBeforeSell
        peakBeforeCount++
      }
      if (dp.firstSellMarketCap != null && typeof dp.firstSellMarketCap === 'number') {
        firstSellData.push({ 
          x: 1 + addJitter(), 
          y: dp.firstSellMarketCap,
          token: dp.token,
          tokenAddress: dp.tokenAddress
        })
        firstSellSum += dp.firstSellMarketCap
        firstSellCount++
      }
      if (dp.peakMarketCapAfterSell != null && typeof dp.peakMarketCapAfterSell === 'number') {
        peakAfterData.push({ 
          x: 2 + addJitter(), 
          y: dp.peakMarketCapAfterSell,
          token: dp.token,
          tokenAddress: dp.tokenAddress
        })
        peakAfterSum += dp.peakMarketCapAfterSell
        peakAfterCount++
      }
    })
    
    const avgPeakBefore = peakBeforeCount > 0 ? peakBeforeSum / peakBeforeCount : null
    const avgFirstSell = firstSellCount > 0 ? firstSellSum / firstSellCount : null
    const avgPeakAfter = peakAfterCount > 0 ? peakAfterSum / peakAfterCount : null
    
    // Check if canvas is still available after async operation
    if (!chartCanvas.value) {
      loading.value = false
      return
    }
    
    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) {
      loading.value = false
      return
    }
    
    const datasets: any[] = [
      {
        label: `Peak before 1st Sell (Avg: ${formatMarketCap(avgPeakBefore)})`,
        data: peakBeforeData,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        pointRadius: 5,
        pointHoverRadius: 7
      },
      {
        label: `1st Sell (Avg: ${formatMarketCap(avgFirstSell)})`,
        data: firstSellData,
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)',
        pointRadius: 5,
        pointHoverRadius: 7
      },
      {
        label: `Peak after 1st Sell (Avg: ${formatMarketCap(avgPeakAfter)})`,
        data: peakAfterData,
        backgroundColor: 'rgba(168, 85, 247, 0.6)',
        borderColor: 'rgb(168, 85, 247)',
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
    
    if (avgPeakBefore !== null) {
      datasets.push({
        label: 'Avg Peak Before',
        data: [{ x: -0.5, y: avgPeakBefore }, { x: 0.5, y: avgPeakBefore }],
        type: 'line',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        showLine: true
      })
    }
    
    if (avgFirstSell !== null) {
      datasets.push({
        label: 'Avg 1st Sell',
        data: [{ x: 0.5, y: avgFirstSell }, { x: 1.5, y: avgFirstSell }],
        type: 'line',
        borderColor: 'rgba(34, 197, 94, 0.8)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        showLine: true
      })
    }
    
    if (avgPeakAfter !== null) {
      datasets.push({
        label: 'Avg Peak After',
        data: [{ x: 1.5, y: avgPeakAfter }, { x: 2.5, y: avgPeakAfter }],
        type: 'line',
        borderColor: 'rgba(168, 85, 247, 0.8)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        showLine: true
      })
    }
    
    chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: datasets
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
              },
              filter: function(item: any) {
                return !item.text.includes('Avg Peak Before') && 
                       !item.text.includes('Avg 1st Sell') && 
                       !item.text.includes('Avg Peak After')
              }
            }
          },
          tooltip: {
            callbacks: {
              title: function(context: any) {
                const datasetLabel = context[0].dataset.label || ''
                if (datasetLabel.includes('Avg Peak Before') || 
                    datasetLabel.includes('Avg 1st Sell') || 
                    datasetLabel.includes('Avg Peak After')) {
                  if (datasetLabel.includes('Peak Before')) {
                    return 'Average: Peak before 1st Sell'
                  } else if (datasetLabel.includes('1st Sell')) {
                    return 'Average: 1st Sell'
                  } else if (datasetLabel.includes('Peak After')) {
                    return 'Average: Peak after 1st Sell'
                  }
                  return 'Average'
                }
                const dataPoint = context[0].raw
                if (dataPoint && dataPoint.token) {
                  return dataPoint.token
                }
                return context.dataset.label
              },
              label: function(context: any) {
                const value = context.parsed.y
                if (value === null || value === undefined) return ''
                let formattedValue
                if (value >= 1000000) {
                  formattedValue = `$${(value / 1000000).toFixed(2)}M`
                } else if (value >= 1000) {
                  formattedValue = `$${(value / 1000).toFixed(2)}K`
                } else {
                  formattedValue = `$${value.toFixed(2)}`
                }
                
                const datasetLabel = context.dataset.label || ''
                if (datasetLabel.includes('Avg Peak Before') || 
                    datasetLabel.includes('Avg 1st Sell') || 
                    datasetLabel.includes('Avg Peak After')) {
                  return `Average Market Cap: ${formattedValue}`
                }
                
                return `Market Cap: ${formattedValue}`
              },
              afterBody: function(context: any) {
                const datasetLabel = context[0].dataset.label || ''
                if (datasetLabel.includes('Avg Peak Before') || 
                    datasetLabel.includes('Avg 1st Sell') || 
                    datasetLabel.includes('Avg Peak After')) {
                  return []
                }
                
                const dataPoint = context[0].raw
                if (dataPoint && dataPoint.tokenAddress) {
                  return [
                    `Address: ${dataPoint.tokenAddress.substring(0, 8)}...`
                  ]
                }
                return []
              }
            },
            backgroundColor: 'rgba(15, 20, 25, 0.9)',
            titleColor: '#e0e7ff',
            bodyColor: '#e0e7ff',
            borderColor: '#334155',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            ticks: {
              stepSize: 1,
              callback: function(value: any) {
                const index = Math.round(value)
                const labels = ['Peak before 1st Sell', '1st Sell', 'Peak after 1st Sell']
                if (index >= 0 && index < labels.length) {
                  return labels[index]
                }
                return ''
              },
              color: '#94a3b8',
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 12
              }
            },
            grid: {
              color: '#334155',
              display: true
            },
            title: {
              display: false
            },
            min: -0.5,
            max: 2.5
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              callback: function(value: any) {
                if (value >= 1000000) {
                  return '$' + (value / 1000000).toFixed(2) + 'M'
                } else if (value >= 1000) {
                  return '$' + (value / 1000).toFixed(2) + 'K'
                } else {
                  return '$' + value.toFixed(2)
                }
              }
            },
            grid: {
              color: '#334155'
            },
            title: {
              display: true,
              text: 'Market Cap (USD)',
              color: '#94a3b8'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'xy',
          intersect: false
        }
      }
    })
    
    loading.value = false
  } catch (err: any) {
    console.error('Error loading peak price chart:', err)
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
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
}

.modal-header h2 {
  margin: 0;
  color: #e0e7ff;
  font-size: 1rem;
}

.modal-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
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
  padding: 12px;
}
</style>
