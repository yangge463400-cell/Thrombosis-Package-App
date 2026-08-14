const TYPE_CHAR = { order: '单', medication: '药', result: '测', package: '套', system: '信' };

Component({
  properties: {
    item: { type: Object, value: {} }
  },
  data: { typeChar: '信' },
  lifetimes: {
    // 首帧渲染后一次性计算，避免 observers 在初始化阶段 setData 触发渲染层不同步
    ready() {
      const t = this.data.item && this.data.item.type;
      this.setData({ typeChar: TYPE_CHAR[t] || '信' });
    }
  },
  observers: {
    // 仅监听 item 整体变化（父组件刷新列表时更新图标字符）
    item(v) {
      const t = v && v.type;
      this.setData({ typeChar: TYPE_CHAR[t] || '信' });
    }
  },
  methods: {
    onTap() { this.triggerEvent('tap', { item: this.data.item }); },
    onLongPress() { this.triggerEvent('longpress', { item: this.data.item }); }
  }
});
