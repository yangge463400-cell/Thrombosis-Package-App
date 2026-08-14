const request = require('../utils/request');

// E. 订单
const createOrder = (packageId, hospitalId) => request({ url: '/api/orders', method: 'POST', data: { packageId, hospitalId } });
const getOrders = (params) => request({ url: '/api/orders', data: params });
const getOrderDetail = (id) => request({ url: `/api/orders/${id}` });
const cancelOrder = (id) => request({ url: `/api/orders/${id}/cancel`, method: 'POST' });
// 支付模拟回调（开发态）
const mockPay = (orderId) => request({ url: '/api/payment/mock-callback', method: 'POST', data: { orderId } });

module.exports = { createOrder, getOrders, getOrderDetail, cancelOrder, mockPay };
