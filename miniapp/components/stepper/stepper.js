Component({
  properties: {
    value: { type: Number, value: 1 },
    min: { type: Number, value: 1 },
    max: { type: Number, value: 99 },
    step: { type: Number, value: 1 },
    unit: { type: String, value: '' }
  },
  methods: {
    onMinus() {
      if (this.data.value <= this.data.min) return;
      this._emit(this.data.value - this.data.step);
    },
    onPlus() {
      if (this.data.value >= this.data.max) return;
      this._emit(this.data.value + this.data.step);
    },
    _emit(v) {
      this.setData({ value: v });
      this.triggerEvent('change', { value: v });
    }
  }
});
