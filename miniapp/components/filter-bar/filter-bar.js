Component({
  properties: {
    cities: { type: Array, value: [] },
    items: { type: Array, value: [] },
    city: { type: String, value: '' },
    itemIds: { type: Array, value: [] },
    sort: { type: String, value: '' }
  },
  data: {
    activeTab: -1,
    checkedItems: [],
    cityText: '地区',
    itemText: '检测项目',
    sortText: '默认排序',
    sorts: [
      { key: '', text: '默认排序' },
      { key: 'price_asc', text: '价格从低到高' },
      { key: 'price_desc', text: '价格从高到低' },
      { key: 'sales', text: '销量优先' }
    ]
  },
  observers: {
    city(v) { this.setData({ cityText: v || '地区' }); },
    sort(v) {
      const s = this.data.sorts.find(x => x.key === v);
      this.setData({ sortText: s ? s.text : '默认排序' });
    },
    'itemIds': function (itemIds) {
      // itemIds 即已选检测项目名称数组（套餐 items 以 name 关联）
      const names = (itemIds || []).slice();
      this.setData({ checkedItems: names, itemText: names.length ? names.join('、') : '检测项目' });
    }
  },
  methods: {
    switchTab(e) {
      const idx = Number(e.currentTarget.dataset.index);
      this.setData({ activeTab: this.data.activeTab === idx ? -1 : idx });
    },
    close() { this.setData({ activeTab: -1 }); },
    selectCity(e) {
      const city = e.currentTarget.dataset.city || '';
      this.setData({ city, activeTab: -1, cityText: city || '地区' });
      this.triggerEvent('change', { city, itemIds: this.data.itemIds, sort: this.data.sort });
    },
    toggleItem(e) {
      const name = e.currentTarget.dataset.name;
      const checked = this.data.checkedItems.slice();
      const idx = checked.indexOf(name);
      if (idx > -1) checked.splice(idx, 1); else checked.push(name);
      this.setData({ checkedItems: checked });
    },
    clearItems() {
      this.setData({ checkedItems: [] });
      this._emitItems();
    },
    confirmItems() {
      this._emitItems();
      this.setData({ activeTab: -1 });
    },
    _emitItems() {
      // 已选项目名称数组（套餐 items 以 name 关联过滤）
      const itemIds = this.data.checkedItems.slice();
      const text = this.data.checkedItems.join('、') || '检测项目';
      this.setData({ itemIds, itemText: text });
      this.triggerEvent('change', { city: this.data.city, itemIds, sort: this.data.sort });
    },
    selectSort(e) {
      const { key, text } = e.currentTarget.dataset;
      this.setData({ sort: key, sortText: text, activeTab: -1 });
      this.triggerEvent('change', { city: this.data.city, itemIds: this.data.itemIds, sort: key });
    }
  }
});
