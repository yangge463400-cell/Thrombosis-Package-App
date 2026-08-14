Component({
  properties: {
    icon: { type: String, value: '' },
    text: { type: String, value: '暂无数据' },
    btnText: { type: String, value: '' }
  },
  methods: {
    onBtn() { this.triggerEvent('action'); }
  }
});
