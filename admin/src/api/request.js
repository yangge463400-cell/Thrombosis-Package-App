import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';
import { useAuthStore } from '../stores/auth';

// 开发走 Vite proxy（/api -> localhost:8080）；生产可用 BASE_URL
const baseURL = import.meta.env.VITE_BASE_URL || '';

const request = axios.create({
  baseURL,
  timeout: 15000
});

request.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

request.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && body.code === 0) {
      return body.data;
    }
    // 401：清登录态跳登录
    if (body && body.code === 401) {
      const auth = useAuthStore();
      auth.logout();
      router.push('/login');
      ElMessage.error('登录已过期，请重新登录');
      return Promise.reject(body);
    }
    ElMessage.error((body && body.message) || '请求失败');
    return Promise.reject(body);
  },
  (err) => {
    ElMessage.error(err.message || '网络异常，请检查网络');
    return Promise.reject(err);
  }
);

export default request;
