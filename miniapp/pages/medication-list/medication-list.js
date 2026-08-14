const medApi = require('../../services/medication');
const guard = require('../../utils/guard');
const format = require('../../utils/format');

Page(guard.needUser({
  data: {
    list: [],
    todayPlan: [],
    todayDone: 0,
    assessed: 'normal',
    assessedText: '检测后由医生为您评估',
    assessedDesc: '完成检测后，医生将为您评估血栓风险',
    loading: true
  },

  onShow() {
    this._load();
  },

  async _load() {
    this.setData({ loading: true });
    try {
      const list = await medApi.getMedications();
      const today = format.today();
      let todayPlan = [];
      let todayDone = 0;
      list.forEach(m => {
        if (m.timePoints && m.timePoints.length) {
          m.timePoints.forEach(tp => {
            todayPlan.push({
              key: `${m.id}_${tp.id}`,
              medicationId: m.id,
              timePointId: tp.id,
              time: tp.time,
              dose: `每次${m.dosePerTime || '-'}`,
              taken: false
            });
          });
        }
      });
      // 简化：今日打卡状态由详情接口提供；列表页默认未服，点击后置已服
      const assessed = list.some(m => m.doctorAssessed === 'thrombosis');
      this.setData({
        list,
        todayPlan,
        todayDone,
        assessed: assessed ? 'thrombosis' : 'normal',
        assessedText: assessed ? '已确认血栓风险，建议定期监测' : '检测后由医生为您评估',
        assessedDesc: assessed ? '建议购买抗凝药物效果检测套餐，定期监测用药效果' : '完成检测后，医生将为您评估血栓风险',
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async onRemind(e) {
    const id = e.currentTarget.dataset.id;
    const checked = e.detail.value ? 1 : 0;
    const item = this.data.list.find(m => m.id === id);
    if (!item) return;
    try {
      await medApi.updateMedication(id, {
        drugName: item.drugName,
        dosePerTime: item.dosePerTime,
        timesPerDay: item.timesPerDay,
        timePoints: item.timePoints,
        reminderOn: checked
      });
      item.reminderOn = checked;
      this.setData({ list: this.data.list });
    } catch (err) { /* toast 已处理 */ }
  },

  async onCheckIn(e) {
    const item = e.detail && e.detail.item;
    if (!item) return; // 防原生事件冒泡
    if (item.taken) return;
    try {
      await medApi.checkIn(item.medicationId, item.timePointId);
      const todayPlan = this.data.todayPlan.map(t => {
        if (t.key === item.key) t.taken = true;
        return t;
      });
      const todayDone = todayPlan.filter(t => t.taken).length;
      this.setData({ todayPlan, todayDone });
      wx.showToast({ title: '已标记服用', icon: 'success' });
    } catch (err) { /* toast 已处理 */ }
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/medication-detail/medication-detail?id=${e.currentTarget.dataset.id}` });
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/medication-edit/medication-edit' });
  },

  goPackage() {
    wx.switchTab({ url: '/pages/package-list/package-list' });
  },

  noop() {}
}));
