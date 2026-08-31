<template>
  <div>
    <div class="list-head">
      <div class="page-title">医护管理</div>
      <el-button type="primary" @click="openDialog()">＋ 新增医护</el-button>
    </div>

    <div class="filter-bar">
      <!-- 医院管理员：锁定本院，不可切换 -->
      <el-tag v-if="auth.isHospitalAdmin" size="large" type="warning" class="hospital-lock">
        数据范围：{{ auth.hospitalName || '本院' }}
      </el-tag>
      <!-- 平台管理员：可按医院筛选 -->
      <el-select v-else v-model="filterHospitalId" placeholder="全部医院" clearable style="width:220px;" @change="load">
        <el-option v-for="h in hospitals" :key="h.id" :label="h.name" :value="h.id" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索账号/姓名" clearable style="width:220px; margin-left:12px;" @keyup.enter="load" />
      <el-button type="primary" style="margin-left:12px;" @click="load">查询</el-button>
    </div>

    <el-table :data="list" stripe style="margin-top:16px;">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="phone" label="登录账号" width="150" />
      <el-table-column prop="nickname" label="姓名" min-width="120" />
      <el-table-column label="所属医院" min-width="200">
        <template #default="{ row }">
          <span>{{ row.hospitalName || '未绑定' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ (row.createdAt || '').replace('T', ' ').slice(0, 19) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="warning" @click="openReset(row)">重置密码</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top:16px; justify-content:flex-end;"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="onPage"
    />

    <!-- 新增/编辑医护 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑医护' : '新增医护'" width="480px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="登录账号" required>
          <el-input v-model="form.phone" maxlength="20" placeholder="手机号作为登录账号" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.nickname" maxlength="64" placeholder="显示名称" />
        </el-form-item>
        <el-form-item :label="form.id ? '新密码' : '初始密码'" :required="!form.id">
          <el-input v-model="form.password" type="password" show-password maxlength="32" :placeholder="form.id ? '留空表示不修改' : '6-32 位'" />
        </el-form-item>
        <!-- 平台管理员：指定所属医院；医院管理员：固定本院 -->
        <el-form-item v-if="auth.isAdmin" label="所属医院" required>
          <el-select v-model="form.hospitalId" placeholder="请选择医院" style="width:100%;">
            <el-option v-for="h in hospitals" :key="h.id" :label="h.name" :value="h.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="所属医院">
          <el-input :value="auth.hospitalName" disabled />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="正常" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="420px">
      <el-form label-width="100px">
        <el-form-item label="目标账号">
          <el-input :value="resetTarget.phone" disabled />
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="resetPassword" type="password" show-password maxlength="32" placeholder="6-32 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onResetSave">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/modules/admin';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const filterHospitalId = ref(null);
const hospitals = ref([]);
const dialogVisible = ref(false);
const resetVisible = ref(false);
const saving = ref(false);
const form = ref({});
const resetTarget = ref({});
const resetPassword = ref('');

async function load() {
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      hospitalId: filterHospitalId.value || undefined
    };
    const data = await adminApi.staffs(params);
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (e) { /* toast */ }
}

function onPage(p) {
  page.value = p;
  load();
}

function openDialog(row) {
  // 编辑时只挑后端可写的字段，避免把 role/hospitalName/createdAt 等只读字段提交给后端
  form.value = row
    ? { id: row.id, phone: row.phone, nickname: row.nickname, hospitalId: row.hospitalId ?? null, status: row.status, password: '' }
    : { status: 1, hospitalId: null, password: '' };
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.value.phone) { ElMessage.warning('请输入登录账号'); return; }
  if (!form.value.id && !form.value.password) { ElMessage.warning('请输入初始密码'); return; }
  if (auth.isAdmin && !form.value.hospitalId) { ElMessage.warning('请选择所属医院'); return; }
  saving.value = true;
  const payload = { ...form.value };
  // 编辑时密码留空表示不修改：必须从 payload 剔除空串（后端 @Size(min=6) 对空串会校验失败）
  if (form.value.id && !payload.password) delete payload.password;
  try {
    if (form.value.id) {
      await adminApi.updateStaff(form.value.id, payload);
    } else {
      await adminApi.createStaff(payload);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e) { /* toast */ }
  saving.value = false;
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除医护「${row.nickname || row.phone}」吗？`, '删除确认', { type: 'warning' });
    await adminApi.deleteStaff(row.id);
    ElMessage.success('已删除');
    load();
  } catch (e) { /* 取消或失败 */ }
}

function openReset(row) {
  resetTarget.value = row;
  resetPassword.value = '';
  resetVisible.value = true;
}

async function onResetSave() {
  if (!resetPassword.value || resetPassword.value.length < 6) {
    ElMessage.warning('新密码长度需在 6-32 位');
    return;
  }
  saving.value = true;
  try {
    await adminApi.resetStaffPassword(resetTarget.value.id, resetPassword.value);
    ElMessage.success('密码已重置');
    resetVisible.value = false;
  } catch (e) { /* toast */ }
  saving.value = false;
}

onMounted(async () => {
  // 平台管理员需要医院下拉；医院管理员自动锁定本院
  if (auth.isAdmin) {
    try { hospitals.value = await adminApi.hospitals({}); } catch (e) { /* toast */ }
  }
  load();
});
</script>

<style scoped>
.list-head { display: flex; align-items: center; justify-content: space-between; }
.filter-bar { margin-top: 16px; display: flex; align-items: center; }
.hospital-lock { flex-shrink: 0; }
</style>