<template>
  <div>
    <div class="list-head">
      <div class="page-title">{{ isHospital ? '本院核销记录' : '核销管理' }}</div>
      <el-button type="primary" @click="onExport">导出当前页{{ isHospital ? '本院' : '' }}记录</el-button>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <el-select v-if="!isHospital" v-model="hospitalId" placeholder="医院" clearable style="width:220px" @change="load(1)">
        <el-option v-for="h in hospitals" :key="h.id" :label="h.name" :value="h.id" />
      </el-select>
      <el-date-picker
        v-model="dateRange" type="daterange" value-format="YYYY-MM-DD"
        range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期"
        style="margin-left:12px;" @change="load(1)" />
      <el-select v-model="status" placeholder="状态" clearable style="width:140px; margin-left:12px;" @change="load(1)">
        <el-option label="已核销" value="verified" />
      </el-select>
      <el-button type="primary" style="margin-left:12px;" @click="load(1)">查询</el-button>
    </div>

    <el-table :data="list" stripe style="margin-top:16px;">
      <el-table-column prop="code" label="核销码" width="110" />
      <el-table-column prop="orderId" label="订单ID" width="90" />
      <el-table-column prop="packageName" label="套餐" min-width="160" />
      <el-table-column prop="userPhone" label="用户" width="130" />
      <el-table-column v-if="!isHospital" label="医院" width="140">
        <template #default="{ row }">{{ hospitalName(row.hospitalId) }}</template>
      </el-table-column>
      <el-table-column label="核销人" width="110">
        <template #default="{ row }">{{ staffName(row.staffId) }}</template>
      </el-table-column>
      <el-table-column prop="verifyTime" label="核销时间" width="170" />
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

const auth = useAuthStore();
const isHospital = computed(() => auth.isHospitalAdmin);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const hospitalId = ref(null);
const dateRange = ref(null);
const status = ref('');
const hospitals = ref([]);
const staffs = ref([]);

// ID → 名称映射（列表接口返回的是原始 ID，无名称字段）
const hospitalName = (id) => (hospitals.value.find(h => h.id === id) || {}).name ?? (id ?? '-');
const staffName = (id) => (staffs.value.find(s => s.id === id) || {}).nickname ?? (id ?? '-');

async function load(p) {
  page.value = p || 1;
  try {
    const data = await adminApi.verifyRecords({
      hospitalId: hospitalId.value || undefined,
      dateFrom: dateRange.value ? dateRange.value[0] : undefined,
      dateTo: dateRange.value ? dateRange.value[1] : undefined,
      status: status.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    list.value = (data.list || []).map(r => ({ ...r, verifyTime: formatTime(r.verifyTime) }));
    total.value = data.total;
  } catch (e) { /* toast */ }
}

async function loadHospitals() {
  try {
    hospitals.value = await adminApi.hospitals({});
  } catch (e) { /* 忽略 */ }
}

async function loadStaffs() {
  try {
    const data = await adminApi.staffs({ page: 1, pageSize: 100 });
    staffs.value = data.list || [];
  } catch (e) { /* 忽略 */ }
}

// CSV 单元格转义：防逗号/引号撕裂列
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function onExport() {
  // 显式列映射（与表头一一对应，不再用 Object.values 兜全部字段）
  const header = ['核销码', '订单ID', '套餐', '用户', '医院', '核销人', '核销时间'];
  const lines = list.value.map(r => [
    r.code, r.orderId, r.packageName, r.userPhone,
    hospitalName(r.hospitalId), staffName(r.staffId), r.verifyTime
  ].map(csvCell).join(','));
  // \uFEFF BOM：Excel 直接打开中文不乱码
  const blob = new Blob(['\uFEFF' + header.map(csvCell).join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `核销记录_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

onMounted(() => {
  loadHospitals();
  loadStaffs();
  load(1);
});
</script>

<style scoped>
.list-head { display: flex; align-items: center; justify-content: space-between; }
.filter-bar { margin-top: 16px; }
</style>
