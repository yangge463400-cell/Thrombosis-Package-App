const resultApi = require('../../services/result');
const pkgApi = require('../../services/package');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    id: null,
    result: null,
    loading: true,
    hasAbnormal: false
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const result = await resultApi.getResultDetail(this.data.id);
      const hasAbnormal = (result.reportItems || []).some(i => i.abnormal);
      this.setData({ result, hasAbnormal, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  contactService() {
    wx.showToast({ title: '客服热线：400-000-0000', icon: 'none', duration: 2500 });
  },

  buyAgain() {
    wx.switchTab({ url: '/pages/package-list/package-list' });
  }
}));
