import apiClient from './client';

export const configApi = {
  // 获取配置
  getConfig: () => apiClient.get('/config'),

  // 更新配置
  updateConfig: (data) => apiClient.put('/config', data),

  // 获取呼号列表
  getCallsigns: () => apiClient.get('/config/callsigns'),

  // 添加呼号
  addCallsign: (callsign) => apiClient.post('/config/callsigns', { callsign }),

  // 删除呼号
  deleteCallsign: (callsign) => {
    // 确保呼号被正确编码
    const encodedCallsign = encodeURIComponent(callsign);
    return apiClient.delete(`/config/callsigns/${encodedCallsign}`);
  },

  // 设置主要呼号
  setPrimaryCallsign: (callsign) => apiClient.put('/config/primary-callsign', { callsign }),

  // 重置 QSL 数据
  resetQslData: (password) => apiClient.post('/config/reset-qsl', { password }),

  // 导入 Python 数据库
  importPythonDatabase: (file) => {
    const formData = new FormData();
    formData.append('database', file);
    return apiClient.post('/config/import-python-db', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default configApi;
