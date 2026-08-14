/**
 * 订阅消息封装
 * 模板 ID 集中在 config；开发期（无真实模板）直接返回假成功，跳过真机弹窗
 */
const config = require('../config/index');

const hasRealTemplate = () => {
  return Object.values(config.SUBSCRIBE_TEMPLATES).some(v => !!v);
};

/**
 * 申请订阅消息
 * @param {string[]} keys 模板键，如 ['paySuccess','verifySuccess','resultReady']
 * @returns {Promise<{accepted:string[], denied:string[]}>}
 */
function requestSubscribe(keys = []) {
  const tmplIds = keys.map(k => config.SUBSCRIBE_TEMPLATES[k]).filter(Boolean);
  if (tmplIds.length === 0) {
    // 开发期：模板未配置，直接视为接受
    return Promise.resolve({ accepted: keys, denied: [] });
  }
  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        const accepted = [];
        const denied = [];
        tmplIds.forEach(id => {
          if (res[id] === 'accept') accepted.push(id);
          else denied.push(id);
        });
        resolve({ accepted, denied });
      },
      fail: () => {
        resolve({ accepted: [], denied: tmplIds });
      }
    });
  });
}

/** 触发时机封装（提交订单后申请支付/核销/结果三件套） */
function afterOrder() {
  return requestSubscribe(['paySuccess', 'verifySuccess', 'resultReady']);
}

/** 触发时机封装（保存用药后申请提醒） */
function afterMedication() {
  return requestSubscribe(['medicationRemind', 'packagePush']);
}

module.exports = { requestSubscribe, afterOrder, afterMedication, hasRealTemplate };
