<template>
  <div class="stat-card">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value" :class="{ money: isMoney }">{{ display }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { price } from '../utils/format';

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [Number, String], default: 0 },
  isMoney: { type: Boolean, default: false },
  /** 医院端不显示金额时传 hideMoney */
  hideMoney: { type: Boolean, default: false }
});

const display = computed(() => {
  if (props.hideMoney) return '-';
  if (props.isMoney) return '¥' + price(props.value);
  return props.value;
});
</script>
