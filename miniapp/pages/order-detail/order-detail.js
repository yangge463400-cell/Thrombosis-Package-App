const orderApi = require('../../services/order');
const config = require('../../config/index');
const guard = require('../../utils/guard');
const auth = require('../../utils/auth');

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
    // 自动拉起支付：兼容 pay / payed 两种历史参数；实际触发在 _load 完成后（见 _load），避免订单未加载的竞态
    this._autoPay = options.pay === '1' || options.payed === '1';
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
        qrcodeUrl: ''
      });
      // 二维码接口需鉴权（<image> 无法带 Authorization 头），先下载为 arraybuffer 再转 base64 展示
      if (order.verifyCode) this._loadQrcode(order.id);
      // 订单加载完成后再拉起自动支付（修复 300ms 定时器竞态）；仅待支付订单触发
      if (this._autoPay) {
        this._autoPay = false;
        if (order.status === 'pending_pay') this.onPay();
      }
    } catch (e) {
      wx.showToast({ title: '订单不存在或已删除', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  _loadQrcode(orderId) {
    wx.request({
      url: `${config.BASE_URL}/api/orders/${orderId}/qrcode`,
      method: 'GET',
      responseType: 'arraybuffer',
      header: { Authorization: `Bearer ${auth.getToken()}` },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const base64 = wx.arrayBufferToBase64(res.data);
          this.setData({ qrcodeUrl: `data:image/png;base64,${base64}` });
        }
      }
    });
  },

  toggleCode() {
    this.setData({ codeHidden: !this.data.codeHidden });
  },

  toggleMode() {
    this.setData({ qrMode: !this.data.qrMode });
  },

  onPay() {
    if (!this.data.order) return; // 订单未加载完成时不拉起（弹窗内容依赖 payAmount）
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
