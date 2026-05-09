import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
});

const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isLoggingOut = false;

const shouldRedirectToLogin = (config) => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.location.pathname === '/login') {
    return false;
  }

  const requestUrl = config?.url || '';
  if (requestUrl.includes('/api/auth/login')) {
    return false;
  }

  return true;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && !isLoggingOut && shouldRedirectToLogin(error.config)) {
      isLoggingOut = true;
      clearAuth();
      // Reset flag after redirect so fresh login works
      setTimeout(() => { isLoggingOut = false; }, 2000);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
