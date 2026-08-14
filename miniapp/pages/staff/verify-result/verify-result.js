const guard = require('../../../utils/guard');
const format = require('../../../utils/format');

Page(guard.needStaff({
  data: {
    ok: true,
    code: '',
    packageName: '',
    phone: '',
    time: '',
    failReason: '该核销码无效或已过期'
  },

  onLoad(options) {
    const ok = options.ok === '1';
    this.setData({
      ok,
      code: options.code || '',
      packageName: options.package ? decodeURIComponent(options.package) : '',
      phone: options.phone ? decodeURIComponent(options.phone) : '',
      time: format.formatTime(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      failReason: ok ? '' : this._failReason(options.code)
    });
  },

  _failReason(code) {
    if (!code) return '核销码无效或已过期';
    return '该核销码无效或已过期';
  },

  goHome() {
    wx.reLaunch({ url: '/pages/staff/workbench/workbench' });
  },

  goScan() {
    wx.reLaunch({ url: '/pages/staff/scan/scan' });
  },

  goManual() {
    wx.reLaunch({ url: '/pages/staff/scan/scan' });
  }
}));
