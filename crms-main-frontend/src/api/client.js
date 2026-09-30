import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({ 
  baseURL,
  withCredentials: true 
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    // If backend returns 401, the SSO session is invalid or expired
    if (error.response?.status === 401) {
      // Avoid redirect loops if we are already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
