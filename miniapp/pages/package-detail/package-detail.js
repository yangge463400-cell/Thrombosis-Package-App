const pkgApi = require('../../services/package');
const auth = require('../../utils/auth');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    id: null,
    pkg: null,
    images: [],
    showNotice: false,
    loading: true
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const pkg = await pkgApi.getPackageDetail(this.data.id);
      this.setData({
        pkg,
        images: (pkg.images && pkg.images.length ? pkg.images : [pkg.cover]).filter(Boolean),
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  toggleNotice() {
    this.setData({ showNotice: !this.data.showNotice });
  },

  goHospitals() {
    wx.navigateTo({ url: '/pages/hospital-list/hospital-list' });
  },

  onBuy() {
    if (!auth.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: `/pages/order-confirm/order-confirm?id=${this.data.pkg.id}` });
  }
}));
