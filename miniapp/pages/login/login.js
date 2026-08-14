const authApi = require('../../services/auth');
const staffApi = require('../../services/staff');
const auth = require('../../utils/auth');

Page({
  data: {
    role: 'user',
    agreed: true,
    loading: false,
    authError: false,
    staffPhone: '',
    staffPassword: ''
  },

  switchRole(e) {
    this.setData({ role: e.currentTarget.dataset.role, authError: false });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  // ---------- 用户：微信一键登录 ----------
  onWechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
      return;
    }
    this.setData({ loading: true, authError: false });
    wx.login({
      success: async (res) => {
        try {
          const data = await authApi.wechatLogin(res.code || 'dev_code');
          this._handleWechatResult(data);
        } catch (err) {
          this.setData({ loading: false });
          wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ loading: false, authError: true });
      }
    });
  },

  _handleWechatResult(data) {
    if (data.isRegistered) {
      auth.setLogin(data.token, data.user.role, data.user);
      this.setData({ loading: false });
      if (data.user.role === 'staff') {
        wx.reLaunch({ url: '/pages/staff/workbench/workbench' });
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    } else {
      // 未注册 → 注册页
      this.setData({ loading: false });
      wx.navigateTo({
        url: `/pages/register/register?ticket=${data.registerTicket}`
      });
    }
  },

  // ---------- 医护：账号密码登录 ----------
  async onStaffLogin() {
    const { staffPhone, staffPassword } = this.data;
    if (!staffPhone || !staffPassword) {
      wx.showToast({ title: '请输入手机号和密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await staffApi.staffLogin(staffPhone, staffPassword);
      auth.setLogin(data.token, 'staff', { id: data.staffId, nickname: data.staffName, hospitalId: data.hospitalId });
      this.setData({ loading: false });
      wx.reLaunch({ url: '/pages/staff/workbench/workbench' });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  onStaffPhone(e) { this.setData({ staffPhone: e.detail.value }); },
  onStaffPassword(e) { this.setData({ staffPassword: e.detail.value }); }
});
