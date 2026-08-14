<template>
  <div class="admin-topbar">
    <div class="topbar-left">
      <template v-if="isHospitalAdmin">
        <el-tag class="lock-tag" size="large">{{ auth.hospitalName || '本院' }}</el-tag>
        <el-tag size="large" type="info" style="margin-left:8px;">数据范围：本院</el-tag>
      </template>
      <span v-else class="topbar-title">{{ pageTitle }}</span>
    </div>
    <div class="topbar-right">
      <span style="margin-right:16px; color:#666;">{{ auth.nickname }}</span>
      <el-button link type="primary" @click="onLogout">退出登录</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const isHospitalAdmin = computed(() => auth.isHospitalAdmin);
const pageTitle = computed(() => route.meta.title || '');

function onLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.topbar-left { display: flex; align-items: center; }
.topbar-title { font-size: 16px; font-weight: 600; color: var(--text-heading); }
.topbar-right { display: flex; align-items: center; }
</style>