import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token       = localStorage.getItem('accessToken');
  const workspaceId = localStorage.getItem('activeWorkspaceId');
  if (token)       config.headers.Authorization  = `Bearer ${token}`;
  if (workspaceId) config.headers['X-Workspace-Id'] = workspaceId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
