import apiClient from './client';

export const statsApi = {
  // 获取仪表板统计
  getDashboard: () => apiClient.get('/stats/dashboard'),

  // 获取近期活动
  getRecentActivity: (limit = 10) => apiClient.get('/stats/recent-activity', { params: { limit } }),

  // 获取图表数据
  getCharts: () => apiClient.get('/stats/charts'),
};

export default statsApi;
