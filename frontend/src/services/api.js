import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

let csrfToken = null;

api.interceptors.request.use(async (config) => {
  if (['get', 'head', 'options'].includes(config.method?.toLowerCase())) return config;

  if (!csrfToken) {
    const { data } = await api.get('/auth/csrf');
    csrfToken = data.csrfToken;
  }

  config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

api.interceptors.response.use((response) => {
  if (response.config.url?.endsWith('/auth/logout')) csrfToken = null;
  return response;
});

export default api;
