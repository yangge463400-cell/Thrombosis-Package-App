/**
 * 登录态管理：token / role / user_info 存取
 */
const TOKEN_KEY = 'access_token';
const ROLE_KEY = 'role';
const USER_KEY = 'user_info';

function setLogin(token, role, user) {
  wx.setStorageSync(TOKEN_KEY, token);
  wx.setStorageSync(ROLE_KEY, role);
  if (user) wx.setStorageSync(USER_KEY, user);
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function getRole() {
  return wx.getStorageSync(ROLE_KEY) || '';
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user);
}

function isLoggedIn() {
  return !!getToken();
}

function clearLogin() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(ROLE_KEY);
  wx.removeStorageSync(USER_KEY);
}

module.exports = { setLogin, getToken, getRole, getUser, setUser, isLoggedIn, clearLogin };
