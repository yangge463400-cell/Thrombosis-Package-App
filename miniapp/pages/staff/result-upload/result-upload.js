const staffApi = require('../../../services/staff');
const guard = require('../../../utils/guard');

// 医护出具检测结果：核销后订单（检测中）→ 出具结果 → 已完成
Page(guard.needStaff({
  data: {
    code: '',
    orderInfo: null,
    conclusion: 'normal',
    reportUrl: '',
    querying: false,
    submitting: false
  },

  onCodeInput(e) {
    const code = e.detail.value.replace(/\D/g, '').slice(0, 6);
    this.setData({ code, orderInfo: null });
  },

  onUrlInput(e) {
    this.setData({ reportUrl: e.detail.value });
  },

  setConclusion(e) {
    this.setData({ conclusion: e.currentTarget.dataset.v });
  },

  async onQuery() {
    const code = this.data.code;
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位核销码', icon: 'none' });
      return;
    }
    this.setData({ querying: true });
    try {
      const info = await staffApi.verifyCheck(code);
      this.setData({ orderInfo: info, querying: false });
    } catch (e) {
      this.setData({ querying: false });
    }
  },

  async onSubmit() {
    if (!this.data.orderInfo) {
      wx.showToast({ title: '请先查询订单', icon: 'none' });
      return;
    }
    // 状态机：仅「检测中(verified)」订单可出具结果；paid 需先完成扫码核销
    if (this.data.orderInfo.status === 'paid') {
      wx.showToast({ title: '该订单尚未核销，请先完成扫码核销', icon: 'none', duration: 2000 });
      return;
    }
    this.setData({ submitting: true });
    try {
      const abnormal = this.data.conclusion === 'abnormal';
      const reportItems = [{
        name: '综合结论',
        value: abnormal ? '存在异常，请遵医嘱复查' : '未见明显异常',
        unit: '',
        range: '',
        abnormal
      }];
      await staffApi.uploadResult({
        code: this.data.code,
        reportItems,
        reportUrl: this.data.reportUrl || ''
      });
      this.setData({ submitting: false });
      wx.showToast({ title: '结果已出具，订单已完成', icon: 'success', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      this.setData({ submitting: false });
    }
  }
}));
