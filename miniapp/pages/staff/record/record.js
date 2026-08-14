const staffApi = require('../../../services/staff');
const guard = require('../../../utils/guard');
const format = require('../../../utils/format');

Page(guard.needStaff({
  data: {
    date: '',
    list: [],
    page: 1,
    pageSize: 20,
    finished: false,
    loading: false
  },

  onLoad() {
    this._load(true);
  },

  onPullDownRefresh() {
    this._load(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.finished && !this.data.loading) this._load(false);
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
    this._load(true);
  },

  clearDate() {
    this.setData({ date: '' });
    this._load(true);
  },

  async _load(reset) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const target = reset ? 1 : this.data.page;
      const data = await staffApi.getVerifyRecords({
        date: this.data.date || undefined,
        page: target,
        pageSize: this.data.pageSize
      });
      const list = reset ? data.list : this.data.list.concat(data.list);
      list.forEach(r => {
        r.verifyTime = format.formatTime(r.verifyTime, 'yyyy-MM-dd HH:mm');
      });
      this.setData({
        list,
        page: target + 1,
        finished: this.data.list.length + list.length >= data.total,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  }
}));
