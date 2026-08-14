const hospitalApi = require('../../services/hospital');
const pkgApi = require('../../services/package');
const locationUtil = require('../../utils/location');
const guard = require('../../utils/guard');

Page(guard.needUser({
  data: {
    city: '',
    cities: [],
    list: [],
    showPicker: false,
    loading: true
  },

  async onLoad() {
    this._loadCities();
    const loc = await locationUtil.getLocation();
    if (loc && loc.city) {
      this.setData({ city: loc.city });
    }
    this._load();
  },

  async _loadCities() {
    try {
      const cities = await pkgApi.getDictCities();
      this.setData({ cities: (cities || []).map(c => c.name) });
    } catch (e) { /* 忽略 */ }
  },

  async _load() {
    this.setData({ loading: true });
    try {
      const list = await hospitalApi.getHospitals({ city: this.data.city || undefined });
      this.setData({ list: list || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  openCityPicker() { this.setData({ showPicker: true }); },
  closePicker() { this.setData({ showPicker: false }); },

  selectCity(e) {
    this.setData({ city: e.currentTarget.dataset.city, showPicker: false });
    this._load();
  },

  callPhone(e) {
    wx.makePhoneCall({ phoneNumber: e.currentTarget.dataset.phone });
  },

  openMap(e) {
    const { lat, lng, name } = e.currentTarget.dataset;
    wx.openLocation({
      latitude: Number(lat),
      longitude: Number(lng),
      name,
      scale: 16
    });
  }
}));
