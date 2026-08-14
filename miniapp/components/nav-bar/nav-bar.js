Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: false },
    backType: { type: String, value: 'back' }, // back | home
    backText: { type: String, value: '' },
    rightText: { type: String, value: '' }
  },
  data: {
    statusBarHeight: 20,
    navBarHeight: 44
  },
  lifetimes: {
    attached() {
      const app = getApp();
      if (app && app.globalData) {
        this.setData({
          statusBarHeight: app.globalData.statusBarHeight || 20,
          navBarHeight: app.globalData.navBarHeight || 44
        });
      }
    }
  },
  methods: {
    onBack() {
      if (this.data.backType === 'home') {
        wx.reLaunch({ url: '/pages/index/index' });
        return;
      }
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    },
    onRight() {
      this.triggerEvent('right');
    }
  }
});
