<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <div class="brand-side">
      <div class="brand-logo">血栓检测服务</div>
      <div class="brand-slogan">血管健康管理 · 全流程服务管理后台</div>
    </div>
    <!-- 右侧登录卡 -->
    <div class="form-side">
      <div class="login-card">
        <h2 class="login-title">管理员登录</h2>
        <!-- 医院管理员角色提示 -->
        <div v-if="mode === 'hospital'" class="role-hint">
          <el-tag type="success" size="large">医院管理员</el-tag>
          <span class="role-hint-text">数据范围锁定登录账号所属医院</span>
          <el-button link type="primary" @click="switchMode">切换账号 ›</el-button>
        </div>
        <div v-else class="role-hint role-hint-blue">
          <el-tag type="primary" size="large">平台管理员</el-tag>
          <span class="role-hint-text">可管理全部医院数据</span>
          <el-button link type="primary" @click="switchMode">切换账号 ›</el-button>
        </div>

        <el-form :model="form" label-position="top" @keyup.enter="onLogin">
          <el-form-item label="账号">
            <el-input v-model="form.account" size="large" placeholder="请输入账号" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" size="large" type="password" show-password placeholder="请输入密码" />
          </el-form-item>
          <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="onLogin">
            登 录
          </el-button>
        </el-form>

        <div class="login-tip">
          如需账号请联系平台管理员 · 苏ICP备2026060073号-1
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { adminApi } from '../../api/modules/admin';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const mode = ref('platform');
const form = ref({ account: '', password: '' });

function switchMode() {
  mode.value = mode.value === 'platform' ? 'hospital' : 'platform';
  form.value = { account: '', password: '' };
}

async function onLogin() {
  if (!form.value.account || !form.value.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  loading.value = true;
  try {
    const data = await adminApi.login({ account: form.value.account, password: form.value.password });
    // 校验账号与所选模式匹配
    const expect = mode.value === 'hospital' ? 'hospital_admin' : 'admin';
    if (data.role !== expect) {
      ElMessage.warning('账号与所选角色不匹配，请切换后重试');
      loading.value = false;
      return;
    }
    auth.setLogin(data);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (e) {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  height: 100vh;
}
.brand-side {
  width: 520px;
  background: linear-gradient(160deg, #1677FF 0%, #4D9BFF 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.brand-logo { font-size: 36px; font-weight: bold; letter-spacing: 2px; }
.brand-slogan { font-size: 16px; opacity: 0.85; margin-top: 16px; }
.form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card { width: 400px; }
.login-title { text-align: center; margin-bottom: 24px; color: var(--text-heading); }
.role-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--success-bg);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}
.role-hint-blue { background: var(--primary-bg); }
.role-hint-text { flex: 1; font-size: 13px; color: var(--text-secondary); }
.login-btn { width: 100%; height: 44px; font-size: 16px; }
.login-tip {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
