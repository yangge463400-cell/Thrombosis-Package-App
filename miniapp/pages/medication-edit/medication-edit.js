const medApi = require('../../services/medication');
const subscribe = require('../../utils/subscribe');
const guard = require('../../utils/guard');

const DRUG_CHIPS = ['华法林', '利伐沙班', '达比加群酯', '阿哌沙班', '依诺肝素'];
const DOSE_UNITS = ['mg', '片', '粒', 'ml', 'IU'];

Page(guard.needUser({
  data: {
    id: null,
    drugChips: DRUG_CHIPS,
    drugName: '',
    doseNum: '',
    doseUnitIndex: 0,
    doseUnits: DOSE_UNITS,
    timesPerDay: 2,
    timePoints: [{ id: 'tp1', time: '08:00' }, { id: 'tp2', time: '20:00' }],
    reminderOn: true,
    saving: false,
    _tpSeq: 2
  },

  async onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      try {
        const data = await medApi.getMedicationDetail(options.id);
        const m = data.medication;
        const doseMatch = (m.dosePerTime || '').match(/([\d.]+)\s*([a-zA-Z]+)/);
        this.setData({
          drugName: m.drugName,
          doseNum: doseMatch ? doseMatch[1] : (m.dosePerTime || ''),
          doseUnitIndex: doseMatch ? Math.max(0, DOSE_UNITS.indexOf(doseMatch[2])) : 0,
          timesPerDay: m.timesPerDay || 1,
          timePoints: m.timePoints || [],
          reminderOn: m.reminderOn === 1
        });
      } catch (e) { /* toast */ }
    }
  },

  selectDrug(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ drugName: this.data.drugName === name ? '' : name });
  },
  onDrugName(e) { this.setData({ drugName: e.detail.value }); },
  onDoseNum(e) { this.setData({ doseNum: e.detail.value }); },
  onDoseUnit(e) { this.setData({ doseUnitIndex: Number(e.detail.value) }); },
  onTimesChange(e) { this.setData({ timesPerDay: e.detail.value }); },

  addTime() {
    const seq = this.data._tpSeq + 1;
    const timePoints = this.data.timePoints.concat([{ id: `tp${seq}`, time: '08:00' }]);
    this.setData({ timePoints, _tpSeq: seq });
  },
  removeTime(e) {
    const timePoints = this.data.timePoints.slice();
    timePoints.splice(e.currentTarget.dataset.index, 1);
    this.setData({ timePoints });
  },
  onTimeChange(e) {
    const idx = e.currentTarget.dataset.index;
    const timePoints = this.data.timePoints.slice();
    timePoints[idx].time = e.detail.value;
    this.setData({ timePoints });
  },
  onRemindChange(e) { this.setData({ reminderOn: e.detail.value }); },

  async onSave() {
    const { drugName, doseNum, doseUnitIndex, doseUnits, timesPerDay, timePoints, reminderOn } = this.data;
    if (!drugName) { wx.showToast({ title: '请输入药物名称', icon: 'none' }); return; }
    if (!doseNum || Number(doseNum) <= 0) { wx.showToast({ title: '请输入有效剂量', icon: 'none' }); return; }
    if (!timePoints.length) { wx.showToast({ title: '至少设置一个服用时间点', icon: 'none' }); return; }

    this.setData({ saving: true });
    const payload = {
      drugName,
      dosePerTime: `${doseNum}${doseUnits[doseUnitIndex]}`,
      timesPerDay,
      timePoints,
      reminderOn: reminderOn ? 1 : 0
    };
    try {
      if (this.data.id) {
        await medApi.updateMedication(this.data.id, payload);
      } else {
        await medApi.createMedication(payload);
      }
      // 保存用药后申请订阅消息（提醒）
      subscribe.afterMedication();
      wx.showToast({ title: '保存成功，提醒时间将按新设置执行', icon: 'none', duration: 2500 });
      this.setData({ saving: false });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (err) {
      this.setData({ saving: false });
    }
  }
}));
