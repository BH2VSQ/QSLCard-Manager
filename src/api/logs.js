import apiClient from './client';

export const logsApi = {
  // 获取日志列表
  getList: (params) => apiClient.get('/logs', { params }),

  // 获取单条日志
  getById: (id) => apiClient.get(`/logs/${id}`),

  // 创建日志
  create: (data) => apiClient.post('/logs', data),

  // 更新日志
  update: (id, data) => apiClient.put(`/logs/${id}`, data),

  // 删除日志
  delete: (id) => apiClient.delete(`/logs/${id}`),

  // 批量删除
  batchDelete: (ids) => apiClient.delete('/logs/batch/delete', { data: { ids } }),

  // 重排序
  reorder: () => apiClient.post('/logs/reorder'),

  // 去重
  deduplicate: () => apiClient.post('/logs/deduplicate'),

  // 导入 ADIF
  importAdif: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/logs/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 导出 ADIF
  exportAdif: (ids) => apiClient.get('/logs/export', { params: { ids: ids.join(',') } }),
};

export default logsApi;
