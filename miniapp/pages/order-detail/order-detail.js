const orderApi = require('../../services/order');
const config = require('../../config/index');
const guard = require('../../utils/guard');

const STEP_ORDER = ['pending_pay', 'paid', 'completed'];

Page(guard.needUser({
  data: {
    id: null,
    order: null,
    steps: ['已下单', '已支付', '已完成'],
    stepCurrent: 0,
    statusTitle: '',
    statusDesc: '',
    codeHidden: true,
    qrMode: false,
    qrcodeUrl: '',
    payChannelText: '待支付'
  },

  onLoad(options) {
    this.setData({ id: options.id });
    if (options.pay === '1') {
      setTimeout(() => this.onPay(), 300);
    }
    if (options.code === '1') {
      this.setData({ codeHidden: false });
    }
  },

  onShow() {
    if (this.data.id) this._load();
  },

  async _load() {
    try {
      const order = await orderApi.getOrderDetail(this.data.id);
      const statusIdx = STEP_ORDER.indexOf(order.status);
      const st = config.ORDER_STATUS[order.status] || { text: order.status, type: 'default' };
      const descMap = {
        pending_pay: '请尽快完成支付',
        paid: '请前往合作医院出示核销码',
        completed: '检测已完成，感谢使用',
        cancelled: '订单已取消'
      };
      const channelMap = { wx: '微信支付', alipay: '支付宝' };
      this.setData({
        order,
        stepCurrent: statusIdx > -1 ? statusIdx : 0,
        statusTitle: st.text,
        statusDesc: descMap[order.status] || '',
        payChannelText: order.payChannel ? (channelMap[order.payChannel] || order.payChannel) : '待支付',
        qrcodeUrl: order.verifyCode ? `${config.BASE_URL}/api/orders/${order.id}/qrcode?t=${Date.now()}` : ''
      });
    } catch (e) {
      wx.showToast({ title: '订单不存在或已删除', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  toggleCode() {
    this.setData({ codeHidden: !this.data.codeHidden });
  },

  toggleMode() {
    this.setData({ qrMode: !this.data.qrMode });
  },

  onPay() {
    if (config.DEV.requestPaymentMock) {
      wx.showModal({
        title: '模拟支付',
        content: `确认模拟支付 ¥${this.data.order.payAmount}？`,
        confirmText: '支付成功',
        cancelText: '暂不支付',
        success: async (res) => {
          if (res.confirm) {
            await orderApi.mockPay(this.data.order.id);
            wx.showToast({ title: '支付成功', icon: 'success' });
            this._load();
          }
        }
      });
    }
  },

  onCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      confirmText: '确认取消',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          await orderApi.cancelOrder(this.data.order.id);
          wx.showToast({ title: '已取消', icon: 'success' });
          this._load();
        }
      }
    });
  },

  goHospital() {
    wx.navigateTo({ url: '/pages/hospital-list/hospital-list' });
  },

  goResult() {
    wx.navigateTo({ url: `/pages/result-list/result-list?orderId=${this.data.order.id}` });
  }
}));
