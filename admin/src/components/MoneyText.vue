<template>
  <span v-if="!hideMoney" class="money-text">¥{{ price(value) }}</span>
  <span v-else>-</span>
</template>

<script setup>
import { price } from '../utils/format';

defineProps({
  value: { type: [Number, String], default: 0 },
  /** 医院端隐藏金额 */
  hideMoney: { type: Boolean, default: false }
});
</script>
