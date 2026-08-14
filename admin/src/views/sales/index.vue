<template>
  <div>
    <div class="page-title" style="margin-bottom: 20px;">{{ isHospital ? '本院售卖管理' : '售卖管理' }}</div>

    <!-- 统计卡（医院端不显示金额） -->
    <el-row :gutter="20">
      <el-col :span="8">
        <StatCard :label="isHospital ? '本院售卖份数' : '总销售额'" :value="isHospital ? soldCount : totalAmount" :is-money="!isHospital" :hide-money="isHospital" />
      </el-col>
      <el-col :span="8">
        <StatCard :label="isHospital ? '本院订单数' : '订单数'" :value="orderCount" />
      </el-col>
      <el-col :span="8">
        <StatCard label="退款数" :value="refundCount" />
      </el-col>
    </el-row>

    <el-table :data="list" stripe style="margin-top:20px;">
      <el-table-column prop="orderNo" label="订单号" width="180" />
      <el-table-column prop="packageName" label="套餐" min-width="180" />
      <el-table-column prop="userPhone" label="用户" width="130" />
      <el-table-column v-if="!isHospital" label="金额" width="130">
        <template #default="{ row }"><MoneyText :value="row.payAmount" /></template>
      </el-table-column>
      <el-table-column v-if="!isHospital" label="支付方式" width="110">
        <template #default="{ row }">{{ row.payChannel === 'wx' ? '微信' : row.payChannel === 'alipay' ? '支付宝' : '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="下单时间" width="170" />
    </el-table>

    <el-pagination
      style="margin-top:16px; justify-content:flex-end;"
      layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page"
      @current-change="load" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { adminApi } from '../../api/modules/admin';
import { formatTime } from '../../utils/format';
import StatCard from '../../components/StatCard.vue';
import MoneyText from '../../components/MoneyText.vue';

const auth = useAuthStore();
const isHospital = computed(() => auth.isHospitalAdmin);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const soldCount = ref(0);
const totalAmount = ref(0);
const orderCount = ref(0);
const refundCount = ref(0);

const STATUS = {
  pending_pay: { text: '待支付', type: 'warning' },
  paid: { text: '待检测', type: 'primary' },
  verified: { text: '检测中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' }
};
const statusText = (s) => (STATUS[s] || { text: s }).text;
const statusType = (s) => (STATUS[s] || { type: 'info' }).type;

async function load(p) {
  page.value = p || 1;
  try {
    const data = await adminApi.sales({ page: page.value, pageSize: pageSize.value });
    list.value = (data.list || []).map(r => ({ ...r, createdAt: formatTime(r.createdAt) }));
    total.value = data.total;
    if (isHospital.value) {
      soldCount.value = data.total;
    } else {
      // 全量销售额：来自统计接口（全部已支付订单），不随当前页变化
      const st = await adminApi.statistics();
      totalAmount.value = st.totalSold || 0;
      orderCount.value = data.total;
    }
  } catch (e) { /* toast */ }
}

onMounted(() => load(1));
</script>
