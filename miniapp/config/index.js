/**
 * 全局配置
 * 说明：后端就绪后仅需修改 BASE_URL；订阅模板 ID 由后端/C 平台提供后替换
 */
module.exports = {
  // 后端服务地址（本地 Spring Boot；微信开发者工具需勾选「不校验合法域名」）
  BASE_URL: 'http://localhost:8080',

  // 开发态能力开关：微信原生能力在无真实凭据时的降级行为
  // requestPaymentMock: true 时「立即支付」走后端模拟支付回调接口
  DEV: {
    // 注意：后端真实微信支付尚未实现（无下单签名/回调验签）。
    // 置 false 前必须先接入真实支付，否则支付必然失败（后端返回 403 模拟支付未开放）
    requestPaymentMock: true,   // 支付：调用 /api/payment/mock-callback 模拟
    scanCodeMock: false,        // 扫码：false 时优先真实 wx.scanCode，失败降级手动输入
    locationMock: true          // 定位：直接返回北京坐标（避免隐私弹窗）
  },

  // 订阅消息模板 ID（占位，待后端提供真实模板 ID）
  SUBSCRIBE_TEMPLATES: {
    paySuccess: '',        // 支付成功通知
    verifySuccess: '',     // 核销成功通知
    resultReady: '',       // 检测结果通知
    medicationRemind: '',  // 用药提醒
    packagePush: ''        // 套餐推送提醒
  },

  // 状态文案映射（订单）
  ORDER_STATUS: {
    pending_pay: { text: '待支付', type: 'warning' },
    paid: { text: '待检测', type: 'primary' },
    verified: { text: '检测中', type: 'primary' },
    completed: { text: '已完成', type: 'success' },
    cancelled: { text: '已取消', type: 'default' }
  },

  // 消息分类 tab
  MESSAGE_TYPES: [
    { key: 'all', text: '全部' },
    { key: 'order', text: '订单' },
    { key: 'medication', text: '用药' },
    { key: 'result', text: '检测' },
    { key: 'system', text: '系统' }
  ]
};
