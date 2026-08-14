const fmt = require('../../utils/format');

Component({
  properties: {
    value: { type: null, value: 0 },
    size: { type: String, value: 'normal' }, // big | normal
    color: { type: String, value: 'danger' } // danger | normal
  },
  data: { display: '0.00' },
  observers: {
    value(v) {
      this.setData({ display: fmt.price(v) });
    }
  }
});
