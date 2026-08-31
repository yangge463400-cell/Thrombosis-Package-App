const staffApi = require('../../../services/staff');
const auth = require('../../../utils/auth');
const guard = require('../../../utils/guard');
const config = require('../../../config/index');

Page(guard.needStaff({
  data: {
    code: '',
    checkResult: null,
    confirming: false
  },

  onLoad(options) {
    if (options.code) {
      this.setData({ code: options.code });
      this._check(options.code);
    }
  },

  onScan() {
    if (!config.DEV.scanCodeMock) {
      wx.scanCode({
        onlyFromCamera: true,
        success: (res) => {
          const code = String(res.result || '').replace(/\D/g, '').slice(-6);
          if (code.length === 6) {
            this.setData({ code });
            const vci = this.selectComponent('#vci');
            if (vci) vci._sync(code);
            this._check(code);
          } else {
            wx.showToast({ title: '未识别到有效核销码，可手动输入', icon: 'none' });
          }
        },
        fail: () => {
          // 用户取消扫码或相机不可用：页面下方有手动输入框，给出提示即可
          wx.showToast({ title: '已取消扫码，可手动输入核销码', icon: 'none' });
        }
      });
    }
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value, checkResult: null });
  },

  onCodeComplete(e) {
    this._check(e.detail.value);
  },

  async _check(code) {
    if (!code || code.length !== 6) return;
    try {
      const result = await staffApi.verifyCheck(code);
      this.setData({ checkResult: result });
    } catch (e) {
      // 校验失败（无效/已使用/过期）→ 结果页失败态
      wx.redirectTo({ url: `/pages/staff/verify-result/verify-result?code=${code}&ok=0` });
    }
  },

  async onConfirm() {
    // 医院由后端取医护账号所属医院，客户端不传
    this.setData({ confirming: true });
    try {
      const result = await staffApi.verifyConfirm(this.data.code);
      this.setData({ confirming: false });
      wx.redirectTo({
        url: `/pages/staff/verify-result/verify-result?code=${this.data.code}&ok=1&orderId=${result.orderId}&package=${encodeURIComponent(this.data.checkResult.packageName || '')}&phone=${encodeURIComponent(this.data.checkResult.userPhone || '')}`
      });
    } catch (e) {
      this.setData({ confirming: false });
      wx.redirectTo({ url: `/pages/staff/verify-result/verify-result?code=${this.data.code}&ok=0` });
    }
  }
}));
