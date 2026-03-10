import apiClient from './client';

export const qslApi = {
  // 生成 QSL 卡片
  generate: (data) => apiClient.post('/qsl/generate', data),

  // 获取日志关联的卡片
  getByLog: (logId) => apiClient.get(`/qsl/by-log/${logId}`),

  // 获取卡片关联的日志
  getLogs: (qslId) => apiClient.get(`/qsl/${qslId}/logs`),
  
  // 获取卡片关联的日志（别名）
  getLogsByQslId: (qslId) => apiClient.get(`/qsl/${qslId}/logs`),

  // 搜索卡片
  search: (prefix, status) => {
    const params = {};
    if (prefix) params.prefix = prefix;
    if (status) params.status = status;
    return apiClient.get('/qsl/search', { params });
  },

  // 扫码出入库
  scan: (qslId) => apiClient.post('/qsl/scan', { qsl_id: qslId }),

  // 回收卡号
  recycle: (qslId, logId) => apiClient.delete(`/qsl/${qslId}/log/${logId}`),

  // 获取卡片详情
  getDetail: (qslId) => apiClient.get(`/qsl/${qslId}`),
  
  // 获取卡片详情（别名）
  getById: (qslId) => apiClient.get(`/qsl/${qslId}`),
};

export default qslApi;
