import { defineStore } from 'pinia';
import { adminApi } from '../api/modules/admin';

const MENUS = {
  admin: [
    { path: '/dashboard', title: '工作台', icon: 'Odometer' },
    { path: '/packages', title: '套餐管理', icon: 'Box' },
    { path: '/verify', title: '核销管理', icon: 'Checked' },
    { path: '/sales', title: '售卖管理', icon: 'ShoppingCart' },
    { path: '/bills', title: '支付账单', icon: 'Money' },
    { path: '/hospitals', title: '医院管理', icon: 'OfficeBuilding' },
    { path: '/hospital-admins', title: '医院管理员', icon: 'User' }
  ],
  hospital_admin: [
    { path: '/dashboard', title: '工作台', icon: 'Odometer' },
    { path: '/staffs', title: '医护管理', icon: 'User' },
    { path: '/verify', title: '核销管理', icon: 'Checked' },
    { path: '/sales', title: '售卖管理', icon: 'ShoppingCart' }
  ]
};

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('admin_token') || '',
    role: localStorage.getItem('admin_role') || '',
    nickname: localStorage.getItem('admin_nickname') || '',
    hospitalId: localStorage.getItem('admin_hospitalId') || null,
    hospitalName: localStorage.getItem('admin_hospitalName') || ''
  }),

  getters: {
    isAdmin: (s) => s.role === 'admin',
    isHospitalAdmin: (s) => s.role === 'hospital_admin',
    menus: (s) => MENUS[s.role] || []
  },

  actions: {
    setLogin(data) {
      this.token = data.token;
      this.role = data.role;
      this.nickname = data.nickname || '';
      this.hospitalId = data.hospitalId || null;
      this.hospitalName = data.hospitalName || '';
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_role', data.role);
      localStorage.setItem('admin_nickname', this.nickname);
      localStorage.setItem('admin_hospitalId', this.hospitalId || '');
      localStorage.setItem('admin_hospitalName', this.hospitalName);
    },
    // 刷新后从后端恢复账号信息（医院名动态获取，不依赖本地缓存）
    async fetchMe() {
      if (!this.token) return;
      try {
        const data = await adminApi.me();
        this.nickname = data.nickname || this.nickname;
        this.hospitalId = data.hospitalId || null;
        this.hospitalName = data.hospitalName || '';
        localStorage.setItem('admin_nickname', this.nickname);
        localStorage.setItem('admin_hospitalId', this.hospitalId || '');
        localStorage.setItem('admin_hospitalName', this.hospitalName);
      } catch (e) { /* 401 由拦截器处理 */ }
    },
    logout() {
      this.token = '';
      this.role = '';
      this.nickname = '';
      this.hospitalId = null;
      this.hospitalName = '';
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_nickname');
      localStorage.removeItem('admin_hospitalId');
      localStorage.removeItem('admin_hospitalName');
    }
  }
});
