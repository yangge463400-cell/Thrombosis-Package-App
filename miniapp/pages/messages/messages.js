const msgApi = require('../../services/message');
const pkgApi = require('../../services/package');
const config = require('../../config/index');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    tabs: config.MESSAGE_TYPES,
    activeType: 'all',
    list: [],
    page: 1,
    pageSize: 20,
    finished: false,
    loading: false
  },

  onShow() {
    this._load(true);
    this._refreshBadge();
  },

  onPullDownRefresh() {
    this._load(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.finished && !this.data.loading) this._load(false);
  },

  switchTab(e) {
    this.setData({ activeType: e.currentTarget.dataset.key });
    this._load(true);
  },

  async _load(reset) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const target = reset ? 1 : this.data.page;
      const data = await msgApi.getMessages({
        type: this.data.activeType,
        page: target,
        pageSize: this.data.pageSize
      });
      const list = reset ? data.list : this.data.list.concat(data.list);
      this.setData({
        list,
        page: target + 1,
        finished: this.data.list.length + list.length >= data.total,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async _refreshBadge() {
    try {
      const d = await pkgApi.getUnreadCount();
      const count = d.count || 0;
      if (count > 0) wx.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) });
      else wx.removeTabBarBadge({ index: 2, fail: () => {} });
    } catch (e) { /* 忽略 */ }
  },

  onTap(e) {
    const item = e.detail && e.detail.item;
    if (!item) return; // 防原生事件冒泡（组件内已 catchtap 阻止，此处双保险）
    wx.navigateTo({ url: `/pages/message-detail/message-detail?id=${item.id}` });
  },

  onLongPress(e) {
    const item = e.detail && e.detail.item;
    if (!item) return;
    wx.showModal({
      title: '删除消息',
      content: '确定要删除该消息吗？',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await msgApi.deleteMessage(item.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            this._load(true);
          } catch (err) { /* toast */ }
        }
      }
    });
  }
}));
