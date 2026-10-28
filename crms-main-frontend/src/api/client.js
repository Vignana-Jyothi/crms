import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({ 
  baseURL,
  withCredentials: true // Automatically send HTTP-only cookies
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // If we get an unauthorized error, the cookie is either missing or expired.
      // We don't try to refresh it locally because that is handled by Google SSO now.
      // Just redirect to login.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
