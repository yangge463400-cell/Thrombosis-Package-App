const request = require('../utils/request');

// F. 医院
const getHospitals = (params) => request({ url: '/api/hospitals', data: params });

module.exports = { getHospitals };
