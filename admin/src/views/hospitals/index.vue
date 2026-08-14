<template>
  <div>
    <div class="list-head">
      <div class="page-title">医院管理</div>
      <el-button type="primary" @click="openDialog()">＋ 新增医院</el-button>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索医院名/城市" clearable style="width:260px" @keyup.enter="load" />
      <el-button type="primary" style="margin-left:12px;" @click="load">查询</el-button>
    </div>

    <el-table :data="list" stripe style="margin-top:16px;">
      <el-table-column prop="name" label="医院名" min-width="200" />
      <el-table-column prop="city" label="城市" width="100" />
      <el-table-column prop="address" label="地址" min-width="220" />
      <el-table-column prop="phone" label="电话" width="140" />
      <el-table-column prop="detectTime" label="可检测时间" width="200" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'cooperating' ? 'success' : 'info'">{{ row.status === 'cooperating' ? '合作中' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑医院' : '新增医院'" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="医院名" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="城市"><el-input v-model="form.city" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="经度"><el-input v-model="form.lng" /></el-form-item>
        <el-form-item label="纬度"><el-input v-model="form.lat" /></el-form-item>
        <el-form-item label="可检测时间"><el-input v-model="form.detectTime" placeholder="如 周一至周六 8:00-11:30" /></el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-value="cooperating" inactive-value="disabled" active-text="合作中" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/modules/admin';

const list = ref([]);
const keyword = ref('');
const dialogVisible = ref(false);
const saving = ref(false);
const form = ref({});

async function load() {
  try {
    list.value = await adminApi.hospitals({ keyword: keyword.value || undefined });
  } catch (e) { /* toast */ }
}

function openDialog(row) {
  form.value = row ? { ...row, lat: String(row.lat ?? ''), lng: String(row.lng ?? '') } : {};
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.value.name) { ElMessage.warning('请输入医院名'); return; }
  saving.value = true;
  const payload = { ...form.value };
  try {
    if (form.value.id) {
      await adminApi.updateHospital(form.value.id, payload);
    } else {
      await adminApi.createHospital(payload);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e) { /* toast */ }
  saving.value = false;
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除医院「${row.name}」吗？`, '删除确认', { type: 'warning' });
    await adminApi.deleteHospital(row.id);
    ElMessage.success('已删除');
    load();
  } catch (e) { /* 取消或失败 */ }
}

onMounted(load);
</script>

<style scoped>
.list-head { display: flex; align-items: center; justify-content: space-between; }
.filter-bar { margin-top: 16px; }
</style>
