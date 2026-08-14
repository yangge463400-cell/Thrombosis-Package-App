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
      this.triggerEvent('start');
      this._begin();
    },
    _begin() {
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
