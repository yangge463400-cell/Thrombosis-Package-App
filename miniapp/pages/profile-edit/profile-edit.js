const userApi = require('../../services/user');
const auth = require('../../utils/auth');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    gender: 0,
    age: '',
    height: '',
    weight: '',
    saving: false
  },

  async onLoad() {
    try {
      const user = await userApi.getProfile();
      this.setData({
        gender: user.gender || 0,
        age: user.age ? String(user.age) : '',
        height: user.height ? String(user.height) : '',
        weight: user.weight ? String(user.weight) : ''
      });
    } catch (e) { /* toast */ }
  },

  setGender(e) { this.setData({ gender: Number(e.currentTarget.dataset.gender) }); },
  onAge(e) { this.setData({ age: e.detail.value }); },
  onHeight(e) { this.setData({ height: e.detail.value }); },
  onWeight(e) { this.setData({ weight: e.detail.value }); },

  async onSave() {
    const { gender, age, height, weight } = this.data;
    const ageN = Number(age), heightN = Number(height), weightN = Number(weight);
    if (age && (ageN < 1 || ageN > 120)) { wx.showToast({ title: '年龄需在 1-120 之间', icon: 'none' }); return; }
    if (height && (heightN < 50 || heightN > 250)) { wx.showToast({ title: '身高需在 50-250cm 之间', icon: 'none' }); return; }
    if (weight && (weightN < 10 || weightN > 300)) { wx.showToast({ title: '体重需在 10-300kg 之间', icon: 'none' }); return; }

    this.setData({ saving: true });
    try {
      const user = await userApi.updateProfile({
        gender,
        age: age ? ageN : null,
        height: height ? heightN : null,
        weight: weight ? weightN : null
      });
      auth.setUser(user);
      wx.showToast({ title: '档案已更新', icon: 'success' });
      this.setData({ saving: false });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      this.setData({ saving: false });
    }
  }
}));
