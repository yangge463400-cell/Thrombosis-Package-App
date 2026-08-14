const request = require('../utils/request');

// J. 医护端
const staffLogin = (phone, password) => request({ url: '/api/staff/login', method: 'POST', data: { phone, password } });
const getStaffStatistics = () => request({ url: '/api/staff/statistics' });
// 核销（医院由后端取医护账号所属医院，客户端无需传，防越权）
const verifyCheck = (code) => request({ url: '/api/verify/check', method: 'POST', data: { code } });
const verifyConfirm = (code) => request({ url: '/api/verify/confirm', method: 'POST', data: { code } });
const getVerifyRecords = (params) => request({ url: '/api/verify/records', data: params });
// 出具检测结果（医院由后端取医护账号所属医院）
const uploadResult = (data) => request({ url: '/api/results/upload', method: 'POST', data });

module.exports = { staffLogin, getStaffStatistics, verifyCheck, verifyConfirm, getVerifyRecords, uploadResult };
