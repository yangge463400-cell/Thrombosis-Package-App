/**
 * 统一请求封装
 * 后端统一返回 { code, message, data }，code === 0 视为成功
 * 401 清登录态 → 跳登录页
 * 关键：过滤掉 undefined / null / 空字符串的字段，避免 wx.request GET 时
 *       把 undefined 序列化成字符串 "undefined" 拼到 URL 上污染后端参数。
 */
const config = require('../config/index');

const cleanParams = (data) => {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    const v = data[k];
    if (v === undefined || v === null || v === '') return;
    out[k] = v;
  });
  return out;
};

const request = (options) => new Promise((resolve, reject) => {
  const token = wx.getStorageSync('access_token');
  wx.request({
    url: `${config.BASE_URL}${options.url}`,
    method: options.method || 'GET',
    data: cleanParams(options.data || {}),
    timeout: 15000,
    header: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...(options.header || {})
    },
    success: (res) => {
      const body = res.data;
      if (body && body.code === 0) {
        resolve(body.data);
        return;
      }
      // 401：清登录态 → 回登录页
      if (body && body.code === 401) {
        wx.removeStorageSync('access_token');
        wx.removeStorageSync('role');
        wx.removeStorageSync('user_info');
        wx.reLaunch({ url: '/pages/login/login' });
        reject(body);
        return;
      }
      const msg = (body && body.message) || '请求失败';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
      reject(body || { code: -1, message: msg });
    },
    fail: (err) => {
      // 小程序访问 http 本地地址被拦截时的友好提示
      wx.showToast({ title: '网络异常，请检查网络', icon: 'none', duration: 2500 });
      reject({ code: -1, message: '网络异常', err });
    }
  });
});

module.exports = request;
