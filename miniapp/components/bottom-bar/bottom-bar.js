const fmt = require('../../utils/format');

Component({
  options: {
    multipleSlots: true
  },
  properties: {
    price: { type: Number, value: 0 }
  },
  data: { priceText: '0.00' },
  observers: {
    price(v) {
      this.setData({ priceText: fmt.price(v) });
    }
  }
});
