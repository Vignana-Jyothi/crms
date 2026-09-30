import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({ 
  baseURL,
  withCredentials: true // Always send SSO cookies to the backend
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    // If backend returns 401 Unauthorized and it's not the check-auth endpoint itself,
    // redirect to login page.
    if (error.response?.status === 401 && !error.config?.url?.includes('/check-auth')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
