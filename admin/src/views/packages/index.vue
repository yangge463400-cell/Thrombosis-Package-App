<template>
  <div>
    <div class="list-head">
      <div class="page-title">套餐管理</div>
      <el-button type="primary" @click="goEdit()">＋ 新增套餐</el-button>
    </div>

    <!-- 搜索筛选 -->
    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索套餐名称" clearable style="width:260px" @keyup.enter="load(1)" />
      <el-select v-model="status" placeholder="状态" clearable style="width:140px; margin-left:12px;" @change="load(1)">
        <el-option label="售卖中" value="on" />
        <el-option label="已下架" value="off" />
      </el-select>
      <el-button type="primary" style="margin-left:12px;" @click="load(1)">查询</el-button>
    </div>

    <el-table :data="list" stripe style="margin-top:16px;" @row-click="goEdit">
      <el-table-column label="封面" width="80">
        <template #default="{ row }">
          <el-image :src="row.cover" style="width:48px;height:48px;border-radius:6px;" fit="cover">
            <template #error><div style="width:48px;height:48px;background:var(--primary-bg);border-radius:6px;"></div></template>
          </el-image>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="套餐名称" min-width="180" />
      <el-table-column label="价格" width="120">
        <template #default="{ row }"><MoneyText :value="row.price" /></template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'on' ? 'success' : 'info'">{{ row.status === 'on' ? '售卖中' : '已下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="salesCount" label="销量" width="90" />
      <el-table-column label="上架/下架" width="120">
        <template #default="{ row }">
          <el-switch :model-value="row.status === 'on'" @change="(v) => toggleStatus(row, v)" @click.stop />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="goEdit(row.id)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top:16px; justify-content:flex-end;"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="load" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { adminApi } from '../../api/modules/admin';
import MoneyText from '../../components/MoneyText.vue';

const router = useRouter();
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const status = ref('');

async function load(p) {
  page.value = p || 1;
  try {
    const data = await adminApi.packages({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: status.value || undefined
    });
    list.value = data.list;
    total.value = data.total;
  } catch (e) { /* toast */ }
}

async function toggleStatus(row, v) {
  try {
    await adminApi.togglePackageStatus(row.id, v ? 'on' : 'off');
    row.status = v ? 'on' : 'off';
    ElMessage.success(v ? '已上架' : '已下架');
  } catch (e) { /* toast */ }
}

function goEdit(id) {
  router.push(id ? `/packages/edit/${id}` : '/packages/edit');
}

onMounted(() => load(1));
</script>

<style scoped>
.list-head { display: flex; align-items: center; justify-content: space-between; }
.filter-bar { margin-top: 16px; }
</style>
