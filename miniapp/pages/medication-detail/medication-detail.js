const medApi = require('../../services/medication');
const guard = require('../../utils/guard');
const format = require('../../utils/format');

Page(guard.needUser({
  data: {
    id: null,
    medication: null,
    timePoints: [],
    timeText: '',
    weekDates: [],
    takenMap: {}
  },

  async onLoad(options) {
    this.setData({ id: options.id });
    // 近 7 日日期
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dates.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    this.setData({ weekDates: dates });
    await this._load();
  },

  async _load() {
    try {
      const data = await medApi.getMedicationDetail(this.data.id);
      const m = data.medication;
      const timePoints = m.timePoints || [];
      const takenMap = {};
      (data.recentRecords || []).forEach(r => {
        const key = `${r.timePointId}_${r.recordDate}`;
        takenMap[key] = r.status === 'taken';
      });
      this.setData({
        medication: m,
        timePoints,
        timeText: timePoints.map(t => t.time).join('、'),
        takenMap
      });
    } catch (e) { /* toast */ }
  },

  isTaken(timePointId, date) {
    const fullDate = `${new Date().getFullYear()}-${date}`;
    return !!this.data.takenMap[`${timePointId}_${fullDate}`];
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/medication-edit/medication-edit?id=${this.data.id}` });
  },

  onDelete() {
    wx.showModal({
      title: '删除用药方案',
      content: '确定要删除该用药方案吗？打卡记录将一并删除。',
      confirmText: '确认删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await medApi.deleteMedication(this.data.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 800);
          } catch (e) { /* toast */ }
        }
      }
    });
  }
}));
