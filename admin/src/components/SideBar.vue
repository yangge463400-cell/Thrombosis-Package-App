<template>
  <aside class="admin-side">
    <div class="admin-logo">
      {{ isHospitalAdmin ? (auth.hospitalName || '医院') + ' · 管理后台' : '血栓检测 · 管理后台' }}
    </div>
    <el-menu class="admin-menu" :default-active="activeMenu" router>
      <el-menu-item v-for="m in auth.menus" :key="m.path" :index="m.path">
        <span class="menu-dot" v-if="activeMenu === m.path"></span>
        <el-icon><component :is="m.icon" /></el-icon>
        <span>{{ m.title }}</span>
      </el-menu-item>
    </el-menu>
    <div style="padding: 16px 16px 8px; font-size: 12px; color: #999;">
      v1.0.0 · {{ auth.isAdmin ? '平台管理员' : '医院管理员' }}
    </div>
    <!-- ICP 备案悬挂（合规要求：备案号链接工信部） -->
    <div style="padding: 0 16px 16px; font-size: 11px; color: #bbb;">
      <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer" style="color:#bbb;text-decoration:none;">苏ICP备2026060073号-1</a>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const isHospitalAdmin = computed(() => auth.isHospitalAdmin);
const activeMenu = computed(() => route.path);
</script>