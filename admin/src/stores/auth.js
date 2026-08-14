import { defineStore } from 'pinia';

const MENUS = {
  admin: [
    { path: '/dashboard', title: '工作台', icon: 'Odometer' },
    { path: '/packages', title: '套餐管理', icon: 'Box' },
    { path: '/verify', title: '核销管理', icon: 'Checked' },
    { path: '/sales', title: '售卖管理', icon: 'ShoppingCart' },
    { path: '/bills', title: '支付账单', icon: 'Money' },
    { path: '/hospitals', title: '医院管理', icon: 'OfficeBuilding' }
  ],
  hospital_admin: [
    { path: '/dashboard', title: '工作台', icon: 'Odometer' },
    { path: '/verify', title: '核销管理', icon: 'Checked' },
    { path: '/sales', title: '售卖管理', icon: 'ShoppingCart' }
  ]
};

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('admin_token') || '',
    role: localStorage.getItem('admin_role') || '',
    nickname: localStorage.getItem('admin_nickname') || '',
    hospitalId: localStorage.getItem('admin_hospitalId') || null
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
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_role', data.role);
      localStorage.setItem('admin_nickname', this.nickname);
      localStorage.setItem('admin_hospitalId', this.hospitalId || '');
    },
    logout() {
      this.token = '';
      this.role = '';
      this.nickname = '';
      this.hospitalId = null;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_nickname');
      localStorage.removeItem('admin_hospitalId');
    }
  }
});
