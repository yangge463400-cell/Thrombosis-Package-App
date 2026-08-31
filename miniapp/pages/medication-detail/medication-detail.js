const medApi = require('../../services/medication');
const guard = require('../../utils/guard');
const format = require('../../utils/format');

Page(guard.needUser({
  data: {
    id: null,
    medication: null,
    timeText: '',
    weekDates: [],
    calendar: []
  },

  async onLoad(options) {
    this.setData({ id: options.id });
    // 近 7 日日期（labels 供表头展示，fulls 含年份用于匹配打卡记录，避免跨年错位）
    const labels = [];
    const fulls = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      labels.push(`${mm}-${dd}`);
      fulls.push(`${d.getFullYear()}-${mm}-${dd}`);
    }
    this._weekFulls = fulls;
    this.setData({ weekDates: labels });
    await this._load();
  },

  async _load() {
    try {
      const data = await medApi.getMedicationDetail(this.data.id);
      const m = data.medication;
      const timePoints = m.timePoints || [];
      const takenSet = new Set((data.recentRecords || [])
        .filter(r => r.status === 'taken')
        .map(r => `${r.timePointId}_${r.recordDate}`));
      // 日历模型在 JS 层预计算，模板零逻辑直接渲染
      const fulls = this._weekFulls || [];
      const calendar = timePoints.map(tp => ({
        id: tp.id,
        time: tp.time,
        cells: fulls.map((full, i) => ({
          date: full,
          taken: takenSet.has(`${tp.id}_${full}`)
        }))
      }));
      this.setData({
        medication: m,
        timeText: timePoints.map(t => t.time).join('、'),
        calendar
      });
    } catch (e) { /* toast */ }
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
