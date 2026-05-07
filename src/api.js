import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isLoggingOut = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Reset flag after redirect so fresh login works
      setTimeout(() => { isLoggingOut = false; }, 2000);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
