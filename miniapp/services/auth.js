const request = require('../utils/request');

// A. 登录注册
const wechatLogin = (code) => request({ url: '/api/auth/wechat-login', method: 'POST', data: { code } });
const sendCode = (phone) => request({ url: '/api/auth/send-code', method: 'POST', data: { phone } });
const register = (data) => request({ url: '/api/auth/register', method: 'POST', data });
const logout = () => request({ url: '/api/auth/logout', method: 'POST' });

module.exports = { wechatLogin, sendCode, register, logout };
