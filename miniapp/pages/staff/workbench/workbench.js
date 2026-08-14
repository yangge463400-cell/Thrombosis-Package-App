const staffApi = require('../../../services/staff');
const hospitalApi = require('../../../services/hospital');
const auth = require('../../../utils/auth');
const guard = require('../../../utils/guard');
const config = require('../../../config/index');

Page(guard.needStaff({
  data: {
    staffName: '',
    hospitalName: '',
    stats: {}
  },

  async onShow() {
    const user = auth.getUser();
    this.setData({ staffName: (user && user.nickname) || '医护' });
    this._loadHospital();
    this._loadStats();
  },

  async _loadHospital() {
    try {
      const hospitals = await hospitalApi.getHospitals({});
      const user = auth.getUser();
      const h = (hospitals || []).find(x => x.id === (user && user.hospitalId));
      if (h) this.setData({ hospitalName: h.name });
    } catch (e) { /* 忽略 */ }
  },

  async _loadStats() {
    try {
      const stats = await staffApi.getStaffStatistics();
      this.setData({ stats });
    } catch (e) { /* toast */ }
  },

  async onScan() {
    if (!config.DEV.scanCodeMock) {
      try {
        const res = await new Promise((resolve, reject) => {
          wx.scanCode({ onlyFromCamera: true, success: resolve, fail: reject });
        });
        // 二维码内容为核销码或 URL（取末尾 6 位数字）
        const code = String(res.result || '').replace(/\D/g, '').slice(-6);
        if (code.length === 6) {
          wx.navigateTo({ url: `/pages/staff/scan/scan?code=${code}` });
        } else {
          this.goManualInput();
        }
        return;
      } catch (e) {
        this.goManualInput();
        return;
      }
    }
    this.goManualInput();
  },

  goManualInput() {
    wx.navigateTo({ url: '/pages/staff/scan/scan' });
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/staff/record/record' });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/staff/result-upload/result-upload' });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出医护账号吗？',
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
