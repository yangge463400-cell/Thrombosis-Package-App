const pkgApi = require('../../services/package');
const auth = require('../../utils/auth');
const guard = require('../../utils/guard');
const config = require('../../config/index');

const GRIDS = [
  { key: 'package', text: '检测套餐', icon: '测', bg: 'gi-blue' },
  { key: 'orders', text: '我的订单', icon: '单', bg: 'gi-green' },
  { key: 'results', text: '检测记录', icon: '报', bg: 'gi-blue' },
  { key: 'medication', text: '用药管理', icon: '药', bg: 'gi-orange' },
  { key: 'messages', text: '消息中心', icon: '信', bg: 'gi-red' },
  { key: 'hospitals', text: '合作医院', icon: '院', bg: 'gi-green' },
  { key: 'help', text: '帮助与客服', icon: '帮', bg: 'gi-gray' },
  { key: 'about', text: '关于我们', icon: '关', bg: 'gi-gray' }
];

Page(guard.needUser({
  data: {
    banners: [],
    grids: GRIDS,
    unreadCount: 0,
    ongoingOrder: null,
    recommendPackages: []
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    try {
      const [home, unread] = await Promise.all([
        pkgApi.getHome(),
        pkgApi.getUnreadCount()
      ]);
      const ongoing = home.ongoingOrder || null;
      if (ongoing) {
        const st = config.ORDER_STATUS[ongoing.status] || { text: ongoing.status, type: 'default' };
        ongoing.statusText = st.text;
        ongoing.statusType = st.type;
      }
      this.setData({
        banners: home.banners || [],
        recommendPackages: home.recommendPackages || [],
        ongoingOrder: ongoing,
        unreadCount: unread.count || 0
      });
      this._setBadge(unread.count || 0);
    } catch (e) {
      // 接口失败展示空态，不阻塞页面
      this.setData({ banners: [], recommendPackages: [] });
    }
  },

  _setBadge(count) {
    if (count > 0) {
      wx.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) });
    } else {
      wx.removeTabBarBadge({ index: 2, fail: () => {} });
    }
  },

  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.linkType === 'package' && item.linkId) {
      wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${item.linkId}` });
    }
  },

  onGridTap(e) {
    const key = e.currentTarget.dataset.key;
    const map = {
      package: '/pages/package-list/package-list',
      orders: '/pages/order-list/order-list',
      results: '/pages/result-list/result-list',
      medication: '/pages/medication-list/medication-list',
      messages: '/pages/messages/messages',
      hospitals: '/pages/hospital-list/hospital-list',
      help: '/pages/messages/messages'
    };
    const tabMap = { package: 1, messages: 2 };
    if (tabMap[key] !== undefined) {
      wx.switchTab({ url: map[key] });
    } else if (map[key]) {
      wx.navigateTo({ url: map[key] });
    } else {
      wx.showToast({ title: '功能建设中', icon: 'none' });
    }
  },

  goPackageList() { wx.switchTab({ url: '/pages/package-list/package-list' }); },
  goPackageDetail(e) { wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${e.currentTarget.dataset.id}` }); },
  goOrderDetail(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
  goPay(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}&pay=1` }); },
  goVerifyCode(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}&code=1` }); },
  goResult(e) { wx.navigateTo({ url: `/pages/result-list/result-list?orderId=${e.currentTarget.dataset.id}` }); },
  noop() {}
}));
