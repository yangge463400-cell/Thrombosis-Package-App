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
import SideBar from '../components/SideBar.vue';
import TopBar from '../components/TopBar.vue';
</script>