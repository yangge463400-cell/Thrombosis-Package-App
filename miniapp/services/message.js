const request = require('../utils/request');

// I. 消息中心
const getMessages = (params) => request({ url: '/api/messages', data: params });
const getMessageDetail = (id) => request({ url: `/api/messages/${id}` });
const markRead = (id) => request({ url: `/api/messages/${id}/read`, method: 'PUT' });
const deleteMessage = (id) => request({ url: `/api/messages/${id}`, method: 'DELETE' });

module.exports = { getMessages, getMessageDetail, markRead, deleteMessage };
