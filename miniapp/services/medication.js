const request = require('../utils/request');

// H. 用药管理
const getMedications = () => request({ url: '/api/medications' });
const getMedicationDetail = (id) => request({ url: `/api/medications/${id}` });
const createMedication = (data) => request({ url: '/api/medications', method: 'POST', data });
const updateMedication = (id, data) => request({ url: `/api/medications/${id}`, method: 'PUT', data });
const deleteMedication = (id) => request({ url: `/api/medications/${id}`, method: 'DELETE' });
const checkIn = (id, timePointId) => request({ url: `/api/medications/${id}/records`, method: 'POST', data: { timePointId } });

module.exports = { getMedications, getMedicationDetail, createMedication, updateMedication, deleteMedication, checkIn };
