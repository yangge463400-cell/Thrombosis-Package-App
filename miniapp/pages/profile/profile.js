const userApi = require('../../services/user');
const pkgApi = require('../../services/package');
const auth = require('../../utils/auth');
const guard = require('../../utils/guard');

const GENDER = { 1: '男', 2: '女', 0: '未填写' };

Page(guard.needUser({
  data: {
    user: {},
    genderText: '未填写',
    unreadCount: 0
  },

  onShow() {
    this._load();
  },

  async _load() {
    try {
      const [user, unread] = await Promise.all([
        userApi.getProfile(),
        pkgApi.getUnreadCount().catch(() => ({ count: 0 }))
      ]);
      auth.setUser(user);
      this.setData({
        user: user || {},
        genderText: GENDER[(user && user.gender) || 0],
        unreadCount: (unread && unread.count) || 0
      });
    } catch (e) { /* toast */ }
  },

  goProfileEdit() { wx.navigateTo({ url: '/pages/profile-edit/profile-edit' }); },
  goOrders() { wx.navigateTo({ url: '/pages/order-list/order-list' }); },
  goResults() { wx.navigateTo({ url: '/pages/result-list/result-list' }); },
  goMedication() { wx.navigateTo({ url: '/pages/medication-list/medication-list' }); },
  goMessages() { wx.switchTab({ url: '/pages/messages/messages' }); },
  goHospitals() { wx.navigateTo({ url: '/pages/hospital-list/hospital-list' }); },
  goHelp() { wx.showToast({ title: '客服热线：400-000-0000', icon: 'none', duration: 2500 }); },
  goAbout() {
    wx.showModal({
      title: '关于我们',
      content: '血栓检测服务 · 血管健康管理专业平台\n版本 v1.0.0',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          auth.clearLogin();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
}));
