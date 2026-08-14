<template>
  <aside class="admin-side">
    <div class="admin-logo">
      {{ isHospitalAdmin ? '北京协和医院 · 管理后台' : '血栓检测 · 管理后台' }}
    </div>
    <el-menu class="admin-menu" :default-active="activeMenu" router>
      <el-menu-item v-for="m in auth.menus" :key="m.path" :index="m.path">
        <span class="menu-dot" v-if="activeMenu === m.path"></span>
        <el-icon><component :is="m.icon" /></el-icon>
        <span>{{ m.title }}</span>
      </el-menu-item>
    </el-menu>
    <div style="padding: 16px; font-size: 12px; color: #999;">
      v1.0.0 · {{ auth.isAdmin ? '平台管理员' : '医院管理员' }}
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