const pkgApi = require('../../services/package');
const guard = require('../../utils/guard');
const config = require('../../config/index');

// 首页 Banner：前端模板渲染（渐变背景 + 标题/副标 + 胶囊按钮 + 装饰圆）
const DEFAULT_BANNERS = [
  {
    id: 'b1',
    title: '血栓早筛 · 安心守护',
    subtitle: '一次检测，全程跟踪血管健康',
    buttonText: '立即预约检测',
    link: '/pages/package-list/package-list',
    gradient: 'linear-gradient(135deg, #1A7FFF 0%, #4A9CFF 55%, #6EB3FF 100%)'
  },
  {
    id: 'b2',
    title: '抗凝用药 · 安全监测',
    subtitle: 'INR 实时跟踪 · 用药更安心',
    buttonText: '去监测',
    link: '/pages/package-list/package-list',
    gradient: 'linear-gradient(135deg, #13C2C2 0%, #52C41A 100%)'
  },
  {
    id: 'b3',
    title: '合作三甲 · 专业可信',
    subtitle: '6 家三甲医院 · 覆盖京沪穗',
    buttonText: '查看医院',
    link: '/pages/hospital-list/hospital-list',
    gradient: 'linear-gradient(135deg, #722ED1 0%, #B37FEB 100%)'
  }
];

// 8 宫格：纯 CSS 扁平图标（按 key 渲染），最后一格为「更多」
const GRIDS = [
  { key: 'package',    text: '检测套餐' },
  { key: 'orders',     text: '我的订单' },
  { key: 'results',    text: '检测记录' },
  { key: 'medication', text: '用药管理' },
  { key: 'messages',   text: '消息中心' },
  { key: 'hospitals',  text: '合作医院' },
  { key: 'help',       text: '帮助客服' },
  { key: 'more',       text: '更多' }
];

// 已售格式化：1.2万+ / 8600+
const fmtSales = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万+';
  return String(v) + '+';
};

// 价格格式化：去掉小数点后的 .00
const fmtPrice = (p) => {
  const v = Number(p) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

Page(guard.needUser({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    banners: DEFAULT_BANNERS,
    bannerIndex: 0,
    grids: GRIDS,
    unreadCount: 0,
    ongoingOrder: null,
    recommendPackages: []
  },

  onLoad() {
    const app = getApp();
    const gd = (app && app.globalData) || {};
    this.setData({
      statusBarHeight: gd.statusBarHeight || 20,
      navBarHeight: gd.navBarHeight || 44
    });
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
      // 推荐套餐：附加展示用字段
      const recs = (home.recommendPackages || []).map((p, i) => ({
        ...p,
        salesText: fmtSales(p.salesCount),
        priceText: fmtPrice(p.price),
        coverEmoji: ['🩺', '💉', '🧬', '🏥', '💊', '🫀'][i % 6],
        coverGradient: [
          'linear-gradient(135deg, #E8F3FF 0%, #D6E8FF 100%)',
          'linear-gradient(135deg, #FFF7E6 0%, #FFF1D6 100%)',
          'linear-gradient(135deg, #F6FFED 0%, #E9F9E0 100%)',
          'linear-gradient(135deg, #FFF1F0 0%, #FFE7E4 100%)',
          'linear-gradient(135deg, #E6FFFB 0%, #D9F7F3 100%)',
          'linear-gradient(135deg, #F9F0FF 0%, #F0E4FF 100%)'
        ][i % 6]
      }));
      this.setData({
        recommendPackages: recs,
        ongoingOrder: ongoing,
        unreadCount: unread.count || 0
      });
      this._setBadge(unread.count || 0);
    } catch (e) {
      // 接口失败：banners 保留默认模板，列表为空
      this.setData({ recommendPackages: [] });
    }
  },

  _setBadge(count) {
    if (count > 0) {
      wx.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) });
    } else {
      wx.removeTabBarBadge({ index: 2, fail: () => {} });
    }
  },

  onBannerChange(e) {
    this.setData({ bannerIndex: e.detail.current });
  },

  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.link) this._safeNavigate(item.link);
  },

  onBannerAction(e) {
    const item = e.currentTarget.dataset.item;
    if (item.link) this._safeNavigate(item.link);
  },

  _safeNavigate(url) {
    const tabUrls = ['/pages/index/index', '/pages/package-list/package-list', '/pages/messages/messages', '/pages/my/my'];
    const pathOnly = url.split('?')[0];
    if (tabUrls.includes(pathOnly)) {
      wx.switchTab({ url: pathOnly });
    } else {
      wx.navigateTo({ url });
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
      hospitals: '/pages/hospital-list/hospital-list'
    };
    const tabMap = { package: 1, messages: 2 };
    if (tabMap[key] !== undefined) {
      wx.switchTab({ url: map[key] });
    } else if (map[key]) {
      wx.navigateTo({ url: map[key] });
    } else {
      // help / more
      wx.showToast({ title: '功能建设中', icon: 'none' });
    }
  },

  goPackageList() { wx.switchTab({ url: '/pages/package-list/package-list' }); },
  goPackageDetail(e) { wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${e.currentTarget.dataset.id}` }); },
  goOrderDetail(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },

  // 订单卡主按钮：按状态跳转
  onOngoingAction() {
    const o = this.data.ongoingOrder;
    if (!o) return;
    if (o.status === 'paid') {
      wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${o.id}&code=1` });
    } else {
      wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${o.id}&pay=1` });
    }
  }
}));