const request = require('../utils/request');

// B. 用户档案
const getProfile = () => request({ url: '/api/user/profile' });
const updateProfile = (data) => request({ url: '/api/user/profile', method: 'PUT', data });

module.exports = { getProfile, updateProfile };
