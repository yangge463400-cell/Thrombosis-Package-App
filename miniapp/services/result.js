const request = require('../utils/request');

// G. 检测结果
const getResults = (params) => request({ url: '/api/results', data: params });
const getResultDetail = (id) => request({ url: `/api/results/${id}` });

module.exports = { getResults, getResultDetail };
