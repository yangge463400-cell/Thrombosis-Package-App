const auth = require('./utils/auth');

App({
  globalData: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonRect: null
  },

  onLaunch() {
    // 自定义导航栏：状态栏高度 + 胶囊按钮位置
    try {
      const sys = wx.getSystemInfoSync();
      const rect = wx.getMenuButtonBoundingClientRect();
      this.globalData.statusBarHeight = sys.statusBarHeight || 20;
      this.globalData.menuButtonRect = rect;
      this.globalData.navBarHeight = (rect.top - sys.statusBarHeight) * 2 + rect.height;
    } catch (e) { /* 模拟器兼容 */ }

    // 启动分流：单 AppID 下按 role 分发
    const token = auth.getToken();
    const role = auth.getRole();
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' });
    } else if (role === 'staff') {
      wx.reLaunch({ url: '/pages/staff/workbench/workbench' });
    }
    // role=user 或未知：停留在入口页（tabBar 首页），不强制跳转
  }
});
