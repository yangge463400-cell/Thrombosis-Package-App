const msgApi = require('../../services/message');
const guard = require('../../utils/guard');

const ACTION_MAP = {
  order: { text: '查看订单', url: '/pages/order-detail/order-detail?id=' },
  result: { text: '查看检测结果', url: '/pages/result-detail/result-detail?id=' },
  package: { text: '查看套餐', url: '/pages/package-detail/package-detail?id=' },
  medication: { text: '去用药管理', url: '/pages/medication-list/medication-list' }
};

Page(guard.needUser({
  data: {
    id: null,
    msg: null,
    actionText: ''
  },

  async onLoad(options) {
    this.setData({ id: options.id });
    try {
      const msg = await msgApi.getMessageDetail(options.id);
      const action = ACTION_MAP[msg.targetType];
      this.setData({ msg, actionText: action ? action.text : '' });
      // 标记已读
      if (msg.isRead === 0) {
        await msgApi.markRead(msg.id);
        msg.isRead = 1;
        this.setData({ msg });
      }
    } catch (e) {
      wx.showToast({ title: '消息不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },

  onAction() {
    const action = ACTION_MAP[this.data.msg.targetType];
    if (!action) return;
    if (action.url.endsWith('=')) {
      wx.navigateTo({ url: `${action.url}${this.data.msg.targetId}` });
    } else {
      wx.navigateTo({ url: action.url });
    }
  }
}));
