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
    } else {
      // 已登录普通用户：入口页即登录页，冷启动应直达首页而非停留在登录页；
      // 若 token 实际已过期，首个请求 401 后由 request 层统一弹回登录页
      wx.switchTab({ url: '/pages/index/index' });
    }
  }
});
