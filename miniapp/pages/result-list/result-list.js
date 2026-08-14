const resultApi = require('../../services/result');
const hospitalApi = require('../../services/hospital');
const guard = require('../../utils/guard');

const STATUS_MAP = {
  pending: { text: '待检测', type: 'warning' },
  uploaded: { text: '检测中', type: 'primary' },
  published: { text: '已出结果', type: 'success' }
};

Page(guard.needUser({
  data: {
    list: [],
    loading: true
  },

  onLoad() {
    this._load();
  },

  onPullDownRefresh() {
    this._load().finally(() => wx.stopPullDownRefresh());
  },

  async _load() {
    this.setData({ loading: true });
    try {
      const data = await resultApi.getResults({ page: 1, pageSize: 50 });
      // 后端 test_result 无 packageName 字段，从详情补齐（简化：列表只展示已有信息）
      const list = (data.list || []).map(r => {
        const st = STATUS_MAP[r.status] || { text: r.status, type: 'default' };
        r.statusText = st.text;
        r.statusType = st.type;
        return r;
      });
      // 异步补齐医院名（尽力而为）
      this._fillHospitals(list);
      this.setData({ list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async _fillHospitals(list) {
    try {
      const hospitals = await hospitalApi.getHospitals({});
      const map = {};
      (hospitals || []).forEach(h => { map[h.id] = h.name; });
      let changed = false;
      list.forEach(r => {
        if (r.hospitalId && map[r.hospitalId]) {
          r.hospitalName = map[r.hospitalId];
          changed = true;
        }
      });
      if (changed) this.setData({ list: this.data.list });
    } catch (e) { /* 忽略 */ }
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/result-detail/result-detail?id=${e.currentTarget.dataset.id}` });
  },

  goPackage() {
    wx.switchTab({ url: '/pages/package-list/package-list' });
  }
}));
