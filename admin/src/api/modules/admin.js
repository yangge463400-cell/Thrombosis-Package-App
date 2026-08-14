import request from '../request';

// 管理端接口模块
export const adminApi = {
  login: (data) => request.post('/api/admin/login', data),
  statistics: () => request.get('/api/admin/statistics'),
  packages: (params) => request.get('/api/admin/packages', { params }),
  createPackage: (data) => request.post('/api/admin/packages', data),
  updatePackage: (id, data) => request.put(`/api/admin/packages/${id}`, data),
  togglePackageStatus: (id, status) => request.put(`/api/admin/packages/${id}/status`, { status }),
  verifyRecords: (params) => request.get('/api/admin/verify-records', { params }),
  sales: (params) => request.get('/api/admin/sales', { params }),
  bills: (params) => request.get('/api/admin/bills', { params }),
  syncBill: (id) => request.post(`/api/admin/bills/${id}/sync`),
  hospitals: (params) => request.get('/api/admin/hospitals', { params }),
  createHospital: (data) => request.post('/api/admin/hospitals', data),
  updateHospital: (id, data) => request.put(`/api/admin/hospitals/${id}`, data),
  deleteHospital: (id) => request.delete(`/api/admin/hospitals/${id}`)
};
