Component({
  properties: {
    seconds: { type: Number, value: 60 },
    text: { type: String, value: '获取验证码' }
  },
  data: { counting: false, remain: 0 },
  lifetimes: {
    detached() {
      if (this._timer) clearInterval(this._timer);
    }
  },
  methods: {
    onStart() {
      if (this.data.counting) return;
      // 仅通知页面发起发送（页面在发送成功后调用 begin() 启动倒计时），
      // 避免"手机号校验失败 / 发送请求失败也锁 60 秒"
      this.triggerEvent('start');
    },
    /** 页面在发送验证码成功后调用，启动倒计时 */
    begin() {
      this._begin();
    },
    _begin() {
      if (this.data.counting) return;
      this.setData({ counting: true, remain: this.data.seconds });
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => {
        const remain = this.data.remain - 1;
        if (remain <= 0) {
          clearInterval(this._timer);
          this.setData({ counting: false, remain: 0 });
          this.triggerEvent('finish');
        } else {
          this.setData({ remain });
        }
      }, 1000);
    }
  }
});
