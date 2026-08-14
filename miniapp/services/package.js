const request = require('../utils/request');

// C/D. 首页聚合 + 套餐 + 字典
const getHome = () => request({ url: '/api/home' });
const getUnreadCount = () => request({ url: '/api/messages/unread-count' });
const getPackages = (params) => request({ url: '/api/packages', data: params });
const getPackageDetail = (id) => request({ url: `/api/packages/${id}` });
const getDictItems = () => request({ url: '/api/dicts/items' });
const getDictCities = () => request({ url: '/api/dicts/cities' });

module.exports = { getHome, getUnreadCount, getPackages, getPackageDetail, getDictItems, getDictCities };
