<template>
  <div class="chart-card" :style="{ height: height + 'px' }">
    <v-chart v-if="loaded" :option="option" autoresize />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

const props = defineProps({
  type: { type: String, default: 'line' }, // line | pie
  data: { type: Array, default: () => [] }, // [{date/value} 或 {name/value}]
  color: { type: String, default: '#1677FF' },
  height: { type: Number, default: 300 }
});

const loaded = ref(false);
onMounted(() => { loaded.value = true; });

const option = computed(() => {
  if (props.type === 'pie') {
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { color: '#666' } },
      series: [{
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '44%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: props.data
      }]
    };
  }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 24, top: 24, bottom: 32 },
    xAxis: { type: 'category', data: props.data.map(d => d.date), axisLabel: { color: '#999' } },
    yAxis: { type: 'value', axisLabel: { color: '#999' }, splitLine: { lineStyle: { color: '#EEF1F6' } } },
    series: [{
      type: 'line',
      smooth: true,
      data: props.data.map(d => d.value),
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: props.color },
      itemStyle: { color: props.color },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: props.color + '66' },
            { offset: 1, color: props.color + '00' }
          ]
        }
      }
    }]
  };
});
</script>

<style scoped>
.chart-card { width: 100%; }
</style>
