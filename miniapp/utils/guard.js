/**
 * 角色守卫：按单 AppID 角色分流
 * withRoleGuard('user', pageConfig) / withRoleGuard('staff', pageConfig)
 * 在页面 onShow 校验 token + role，不匹配则重定向
 */
const auth = require('./auth');

function need(role) {
  return function (pageConfig) {
    const original = pageConfig.onShow || function () {};
    pageConfig.onShow = function (...args) {
      const token = auth.getToken();
      const currentRole = auth.getRole();
      if (!token) {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      if (role && currentRole !== role) {
        if (role === 'user') {
          // staff 误入用户页 → 回医护工作台
          if (currentRole === 'staff') {
            wx.reLaunch({ url: '/pages/staff/workbench/workbench' });
            return;
          }
          wx.reLaunch({ url: '/pages/login/login' });
          return;
        }
        // 用户访问医护页 → 回首页
        wx.switchTab({ url: '/pages/index/index' });
        return;
      }
      original.apply(this, args);
    };
    return pageConfig;
  };
}

module.exports = {
  withRoleGuard: need,
  needUser: need('user'),
  needStaff: need('staff')
};
