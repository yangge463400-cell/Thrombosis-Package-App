<template>
  <div class="admin-layout">
    <SideBar />
    <div class="admin-main">
      <TopBar />
      <div class="admin-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import SideBar from '../components/SideBar.vue';
import TopBar from '../components/TopBar.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

// 刷新后从后端恢复账号/医院信息（医院名动态获取）
onMounted(() => {
  auth.fetchMe();
});
</script>