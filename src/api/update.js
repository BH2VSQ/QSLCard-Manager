import apiClient from './client';

export const updateApi = {
  // 检查更新
  check: () => apiClient.get('/update/check'),

  // 执行更新（git pull + 重启）
  apply: () => apiClient.post('/update/apply'),
};

export default updateApi;
