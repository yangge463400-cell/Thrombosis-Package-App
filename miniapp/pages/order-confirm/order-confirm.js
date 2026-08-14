const pkgApi = require('../../services/package');
const orderApi = require('../../services/order');
const hospitalApi = require('../../services/hospital');
const subscribe = require('../../utils/subscribe');
const config = require('../../config/index');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    id: null,
    pkg: null,
    itemNames: [],
    popText: '',
    hospitals: [],
    hospitalId: null,
    agreed: true,
    submitting: false
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this._loadPkg();
    this._loadHospitals();
  },

  async _loadPkg() {
    try {
      const pkg = await pkgApi.getPackageDetail(this.data.id);
      const itemNames = (pkg.items || []).map(i => i.name);
      const popText = (pkg.targetPopulation || []).join('、');
      this.setData({ pkg, itemNames, popText });
    } catch (e) { /* 加载失败由 request toast */ }
  },

  async _loadHospitals() {
    try {
      const hospitals = await hospitalApi.getHospitals({});
      // 默认选中第一家合作医院
      const first = (hospitals || [])[0];
      this.setData({
        hospitals: hospitals || [],
        hospitalId: first ? first.id : null
      });
    } catch (e) { /* 加载失败由 request toast */ }
  },

  onHospitalChange(e) {
    this.setData({ hospitalId: Number(e.detail.value) });
  },

  toggleAgree() { this.setData({ agreed: !this.data.agreed }); },

  showNotice() {
    wx.showModal({
      title: '检测服务知情同意书',
      content: '本人已知晓：本检测服务仅用于健康管理参考，不构成医疗诊断。检测结果可能存在误差，如有疑问请咨询专业医生。本人同意将检测相关信息用于医疗健康管理服务。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  async onSubmit() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意知情同意书', icon: 'none' });
      return;
    }
    if (!this.data.hospitalId) {
      wx.showToast({ title: '请选择核销医院', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const data = await orderApi.createOrder(this.data.pkg.id, this.data.hospitalId);
      // 申请订阅消息（支付成功/核销/结果）
      subscribe.afterOrder();
      this.setData({ submitting: false });

      // 支付：开发态走模拟支付
      if (config.DEV.requestPaymentMock) {
        wx.showModal({
          title: '模拟支付',
          content: `订单金额 ¥${data.payAmount}，确认模拟支付成功？`,
          confirmText: '支付成功',
          cancelText: '暂不支付',
          success: async (res) => {
            if (res.confirm) {
              await orderApi.mockPay(data.orderId);
              wx.showToast({ title: '支付成功', icon: 'success' });
              setTimeout(() => {
                wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${data.orderId}&payed=1` });
              }, 800);
            } else {
              wx.showToast({ title: '订单已保留，可稍后支付', icon: 'none' });
              wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${data.orderId}` });
            }
          }
        });
      } else {
        // 真实支付：wx.requestPayment（参数由后端生成）
        this._realPay(data);
      }
    } catch (e) {
      this.setData({ submitting: false });
    }
  },

  _realPay(data) {
    const params = data.payParams;
    wx.requestPayment({
      ...params,
      success: () => {
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${data.orderId}` }), 800);
      },
      fail: () => {
        wx.showToast({ title: '支付失败，请重新支付', icon: 'none' });
        wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${data.orderId}` });
      }
    });
  }
}));
