Component({
  properties: {
    pkg: { type: Object, value: {} }
  },
  data: { itemNames: [] },
  observers: {
    'pkg.items': function (items) {
      if (!items || !items.length) return;
      const names = items.slice(0, 3).map(i => i.name || i);
      this.setData({ itemNames: names });
    }
  },
  methods: {
    onTap() { this.triggerEvent('tap', { id: this.data.pkg.id }); }
  }
});
