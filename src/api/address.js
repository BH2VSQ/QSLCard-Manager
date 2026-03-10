import apiClient from './client';

export const addressApi = {
  // 获取地址列表
  getList: (params) => apiClient.get('/address', { params }),

  // 按呼号查询
  getByCallsign: (callsign) => apiClient.get(`/address/callsign/${callsign}`),

  // 创建/更新地址
  save: (data) => apiClient.post('/address', data),

  // 删除地址
  delete: (callsign) => apiClient.delete(`/address/${callsign}`),

  // 获取发件人默认地址
  getSenderDefault: () => apiClient.get('/address/sender/default'),

  // 更新发件人默认地址
  updateSenderDefault: (data) => apiClient.put('/address/sender/default', data),
};

export default addressApi;
