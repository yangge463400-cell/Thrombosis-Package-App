Component({
  properties: {
    length: { type: Number, value: 6 },
    value: { type: String, value: '' }
  },
  data: { cells: [], focus: false },
  lifetimes: {
    attached() {
      this._sync(this.data.value);
    }
  },
  observers: {
    value(v) { this._sync(v || ''); }
  },
  methods: {
    _sync(v) {
      const cells = [];
      for (let i = 0; i < this.data.length; i++) {
        cells.push(v[i] || '');
      }
      this.setData({ cells });
    },
    focusInput() { this.setData({ focus: true }); },
    onInput(e) {
      const v = e.detail.value;
      this.triggerEvent('input', { value: v });
      if (v.length >= this.data.length) {
        this.triggerEvent('complete', { value: v });
      }
    },
    onBlur() { this.setData({ focus: false }); }
  }
});
