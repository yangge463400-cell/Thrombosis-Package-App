/**
 * 定位封装：dev 下直接返回北京坐标，避免隐私授权弹窗；
 * 真实环境调用 wx.getLocation，失败降级返回 null（由页面走城市手动选择）
 */
const config = require('../config/index');

function getLocation() {
  if (config.DEV.locationMock) {
    return Promise.resolve({ latitude: 39.914, longitude: 116.415, city: '北京' });
  }
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude, city: '' }),
      fail: () => resolve(null)
    });
  });
}

module.exports = { getLocation };
