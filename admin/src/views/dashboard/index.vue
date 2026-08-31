<template>
  <div>
    <div class="page-title" style="margin-bottom: 20px;">工作台</div>

    <!-- 统计卡 -->
    <el-row :gutter="20">
      <el-col :span="6">
        <!-- 医院端展示计数（后端专门提供无金额口径），不能用 hide-money 隐藏 -->
        <StatCard :label="isHospital ? '今日本院订单数' : '今日销售额'" :value="isHospital ? stats.todayOrders : stats.todaySales" :is-money="!isHospital" />
      </el-col>
      <el-col :span="6">
        <StatCard :label="isHospital ? '今日本院核销数' : '今日订单数'" :value="isHospital ? stats.todayVerified : stats.todayOrders" />
      </el-col>
      <el-col :span="6">
        <StatCard label="待核销数" :value="stats.pendingVerify" />
      </el-col>
      <el-col :span="6">
        <StatCard :label="isHospital ? '累计售卖份数' : '累计售出金额'" :value="isHospital ? stats.totalPackages : stats.totalSold" :is-money="!isHospital" />
      </el-col>
    </el-row>

    <!-- 图表 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="14">
        <div class="stat-card">
          <div style="font-size:16px;font-weight:600;color:var(--text-heading);margin-bottom:8px;">
            {{ isHospital ? '本院近 7 日核销趋势' : '近 7 日销售额（元）' }}
          </div>
          <ChartCard :type="'line'" :data="stats.trend || []" :color="isHospital ? '#52C41A' : '#1677FF'" :height="280" />
        </div>
      </el-col>
      <el-col :span="10">
        <div class="stat-card">
          <div style="font-size:16px;font-weight:600;color:var(--text-heading);margin-bottom:8px;">
            {{ isHospital ? '本院套餐占比' : '各医院售卖占比' }}
          </div>
          <!-- 后端：平台角色键为 hospitalShare，医院角色键为 packageShare，两者兼容 -->
          <ChartCard :type="'pie'" :data="stats.packageShare || stats.hospitalShare || []" :height="280" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { adminApi } from '../../api/modules/admin';
import StatCard from '../../components/StatCard.vue';
import ChartCard from '../../components/ChartCard.vue';

const auth = useAuthStore();
const stats = ref({});
const isHospital = computed(() => auth.isHospitalAdmin);

onMounted(async () => {
  try {
    stats.value = await adminApi.statistics();
  } catch (e) { /* toast */ }
});
</script>
