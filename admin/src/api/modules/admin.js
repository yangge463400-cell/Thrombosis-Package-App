import request from '../request';

// 管理端接口模块
export const adminApi = {
  login: (data) => request.post('/api/admin/login', data),
  me: () => request.get('/api/admin/me'),
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
  deleteHospital: (id) => request.delete(`/api/admin/hospitals/${id}`),
  // 医护管理
  staffs: (params) => request.get('/api/admin/staffs', { params }),
  createStaff: (data) => request.post('/api/admin/staffs', data),
  updateStaff: (id, data) => request.put(`/api/admin/staffs/${id}`, data),
  deleteStaff: (id) => request.delete(`/api/admin/staffs/${id}`),
  resetStaffPassword: (id, password) => request.post(`/api/admin/staffs/${id}/reset-password`, { password }),
  // 医院管理员管理
  hospitalAdmins: (params) => request.get('/api/admin/hospital-admins', { params }),
  createHospitalAdmin: (data) => request.post('/api/admin/hospital-admins', data),
  updateHospitalAdmin: (id, data) => request.put(`/api/admin/hospital-admins/${id}`, data),
  deleteHospitalAdmin: (id) => request.delete(`/api/admin/hospital-admins/${id}`),
  resetHospitalAdminPassword: (id, password) => request.post(`/api/admin/hospital-admins/${id}/reset-password`, { password })
};
