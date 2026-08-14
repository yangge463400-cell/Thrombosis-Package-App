const pkgApi = require('../../services/package');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    list: [],
    page: 1,
    pageSize: 10,
    finished: false,
    loading: false,
    cities: [],
    dictItems: [],
    city: '',
    itemIds: [],
    sort: ''
  },

  async onLoad() {
    this._loadDicts();
    this._loadList(true);
  },

  onPullDownRefresh() {
    this._loadList(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.finished && !this.data.loading) {
      this._loadList(false);
    }
  },

  async _loadDicts() {
    try {
      const [items, cities] = await Promise.all([pkgApi.getDictItems(), pkgApi.getDictCities()]);
      this.setData({ dictItems: items || [], cities: (cities || []).map(c => c.name) });
    } catch (e) { /* 字典失败不阻塞 */ }
  },

  async _loadList(reset) {
    const { page, pageSize, city, itemIds, sort, loading, finished } = this.data;
    // 筛选（reset=true）时即使正在加载也立即重新请求，避免"点地区没反应"
    if (loading && !reset) return;
    if (!reset && finished) return;
    const reqId = (this._reqId || 0) + 1;
    this._reqId = reqId;
    this.setData({ loading: true });
    try {
      const target = reset ? 1 : page;
      const data = await pkgApi.getPackages({
        page: target,
        pageSize,
        city: city || undefined,
        itemIds: itemIds.length ? itemIds.join(',') : undefined,
        sort: sort || undefined
      });
      // 丢弃过期响应（期间又有新筛选请求）
      if (reqId !== this._reqId) return;
      const list = reset ? data.list : this.data.list.concat(data.list);
      this.setData({
        list,
        page: target + 1,
        finished: list.length >= data.total,
        loading: false
      });
    } catch (e) {
      if (reqId !== this._reqId) return;
      this.setData({ loading: false });
    }
  },

  onFilterChange(e) {
    this.setData({
      city: e.detail.city,
      itemIds: e.detail.itemIds || [],
      sort: e.detail.sort || ''
    });
    this._loadList(true);
  },

  onCardTap(e) {
    if (!e.detail || !e.detail.id) return; // 防原生事件冒泡
    wx.navigateTo({ url: `/pages/package-detail/package-detail?id=${e.detail.id}` });
  },

  clearFilter() {
    this.setData({ city: '', itemIds: [], sort: '' });
    this._loadList(true);
  }
}));
