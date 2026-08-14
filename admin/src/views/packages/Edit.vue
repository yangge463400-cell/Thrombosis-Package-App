<template>
  <div>
    <div class="page-title" style="margin-bottom: 20px;">{{ isEdit ? '编辑套餐' : '新增套餐' }}</div>

    <el-card style="max-width: 900px;">
      <el-form :model="form" label-width="120px">
        <el-form-item label="套餐名称" required>
          <el-input v-model="form.name" placeholder="请输入套餐名称" />
        </el-form-item>
        <el-form-item label="价格（¥）" required>
          <el-input-number v-model="form.price" :min="1" :precision="2" :step="10" style="width:200px" />
          <span style="margin-left:12px;color:#999;">管理员配置，前端按此展示</span>
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="form.cover" placeholder="封面图 URL（本地演示可用 /images/placeholder/package1.png）" />
        </el-form-item>
        <el-form-item label="轮播图">
          <el-input v-model="form.imagesText" placeholder="多张图片 URL，英文逗号分隔（可选）" />
        </el-form-item>
        <el-form-item label="检测项目">
          <div class="chips">
            <el-check-tag v-for="it in form.items" :key="it.name" :checked="true" closable @close="removeItem(it)" style="margin:4px;">
              {{ it.name }}
            </el-check-tag>
          </div>
          <div class="add-row" style="margin-top:8px;">
            <el-input v-model="newItem.name" placeholder="项目名称" style="width:200px" />
            <el-input v-model="newItem.desc" placeholder="项目说明" style="width:260px; margin-left:8px;" />
            <el-button style="margin-left:8px;" @click="addItem">添加</el-button>
          </div>
        </el-form-item>
        <el-form-item label="适用人群">
          <el-select v-model="form.targetPopulation" multiple filterable allow-create default-first-option placeholder="选择或输入人群" style="width:100%">
            <el-option v-for="p in ['久坐人群','术后恢复期','有血栓家族史','40岁以上','60岁以上']" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="覆盖城市">
          <el-select v-model="form.cities" multiple placeholder="覆盖城市" style="width:100%">
            <el-option v-for="c in ['北京','上海','广州']" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="购买须知">
          <el-input v-model="form.notice" type="textarea" :rows="3" placeholder="填写购买须知" />
        </el-form-item>
        <el-form-item label="上下架">
          <el-switch v-model="form.status" active-value="on" inactive-value="off" active-text="售卖中" inactive-text="已下架" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { adminApi } from '../../api/modules/admin';
import request from '../../api/request';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const saving = ref(false);
const newItem = ref({ name: '', desc: '' });
const form = ref({
  name: '',
  price: 100,
  cover: '',
  imagesText: '',
  items: [],
  targetPopulation: [],
  cities: [],
  notice: '',
  status: 'on'
});

onMounted(async () => {
  if (isEdit.value) {
    try {
      // 套餐详情走公开接口获取
      const pkg = await request.get('/api/packages/' + route.params.id);
      form.value = {
        name: pkg.name,
        price: Number(pkg.price),
        cover: pkg.cover || '',
        imagesText: (pkg.images || []).join(','),
        items: pkg.items || [],
        targetPopulation: pkg.targetPopulation || [],
        cities: pkg.cities || [],
        notice: pkg.notice || '',
        status: pkg.status || 'on'
      };
    } catch (e) { /* toast */ }
  }
});

function addItem() {
  if (!newItem.value.name) return;
  form.value.items.push({ name: newItem.value.name, desc: newItem.value.desc });
  newItem.value = { name: '', desc: '' };
}
function removeItem(it) {
  form.value.items = form.value.items.filter(i => i !== it);
}

async function onSave() {
  if (!form.value.name) { ElMessage.warning('请输入套餐名称'); return; }
  saving.value = true;
  const payload = {
    name: form.value.name,
    price: form.value.price,
    cover: form.value.cover,
    images: form.value.imagesText ? form.value.imagesText.split(',').map(s => s.trim()).filter(Boolean) : [form.value.cover],
    items: form.value.items,
    targetPopulation: form.value.targetPopulation,
    cities: form.value.cities,
    notice: form.value.notice,
    status: form.value.status
  };
  try {
    if (isEdit.value) {
      await adminApi.updatePackage(route.params.id, payload);
    } else {
      await adminApi.createPackage(payload);
    }
    ElMessage.success('保存成功');
    router.push('/packages');
  } catch (e) {
    saving.value = false;
  }
}
</script>

<style scoped>
.chips { display: flex; flex-wrap: wrap; }
.add-row { display: flex; }
</style>
