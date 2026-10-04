import axios from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // 默认超时提升到 5 分钟：导入、去重、重排序等操作在数据量较大或服务器性能较低时
  // 可能耗时较长，过短的超时会导致前端提前判定失败，而后端仍在继续处理。
  timeout: 5 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // 统一错误处理
    const message = error.response?.data?.error || error.message || '请求失败';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export default apiClient;
