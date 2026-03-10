import apiClient from './client';

export const printApi = {
  // 添加到打印队列
  addToQueue: (data) => apiClient.post('/print/queue', data),

  // 获取打印队列
  getQueue: () => apiClient.get('/print/queue'),

  // 批量准备打印
  generateBatch: (queueIds) => apiClient.post('/print/generate/batch', { queue_ids: queueIds }),

  // 从队列移除
  removeFromQueue: (id) => apiClient.delete(`/print/queue/${id}`),

  // 清空队列
  clearQueue: () => apiClient.delete('/print/queue'),
};

export default printApi;
