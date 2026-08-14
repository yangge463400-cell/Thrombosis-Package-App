const orderApi = require('../../services/order');
const config = require('../../config/index');
const guard = require('../../utils/guard');

const TABS = [
  { key: 'all', text: '全部' },
  { key: 'pending_pay', text: '待支付' },
  { key: 'paid', text: '待检测' },
  { key: 'completed', text: '已完成' },
  { key: 'cancelled', text: '已取消' }
];

Page(guard.needUser({
  data: {
    tabs: TABS,
    activeStatus: 'all',
    list: [],
    page: 1,
    pageSize: 10,
    finished: false,
    loading: false
  },

  onLoad(options) {
    if (options.status) {
      this.setData({ activeStatus: options.status });
    }
    this._load(true);
  },

  onPullDownRefresh() {
    this._load(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.finished && !this.data.loading) this._load(false);
  },

  switchTab(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.key });
    this._load(true);
  },

  async _load(reset) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const target = reset ? 1 : this.data.page;
      const data = await orderApi.getOrders({
        status: this.data.activeStatus,
        page: target,
        pageSize: this.data.pageSize
      });
      const list = (data.list || []).map(o => {
        const st = config.ORDER_STATUS[o.status] || { text: o.status, type: 'default' };
        o.statusText = st.text;
        o.statusType = st.type;
        return o;
      });
      this.setData({
        list: reset ? list : this.data.list.concat(list),
        page: target + 1,
        finished: this.data.list.length + list.length >= data.total,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  goDetail(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
  goPay(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}&pay=1` }); },
  goCode(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}&code=1` }); },
  goHospital() { wx.navigateTo({ url: '/pages/hospital-list/hospital-list' }); },
  goResult(e) { wx.navigateTo({ url: `/pages/result-list/result-list?orderId=${e.currentTarget.dataset.id}` }); },
  goPackage() { wx.switchTab({ url: '/pages/package-list/package-list' }); },

  onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      confirmText: '确认取消',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await orderApi.cancelOrder(id);
            wx.showToast({ title: '已取消', icon: 'success' });
            this._load(true);
          } catch (err) { /* toast 已处理 */ }
        }
      }
    });
  },

  noop() {}
}));
