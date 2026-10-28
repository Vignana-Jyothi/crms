import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({ baseURL });

function getAccessToken() {
  return localStorage.getItem('crms_access_token');
}
function getRefreshToken() {
  return localStorage.getItem('crms_refresh_token');
}
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('crms_access_token', accessToken);
  if (refreshToken) localStorage.setItem('crms_refresh_token', refreshToken);
}
export function clearTokens() {
  localStorage.removeItem('crms_access_token');
  localStorage.removeItem('crms_refresh_token');
}

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If an access token expires mid-session, try exactly once to refresh
// it silently and replay the original request, rather than kicking
// the user back to /login for something that shouldn't interrupt them.
let refreshInFlight = null;

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint =
      original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
      
    if (error.response?.status === 401 && !original?._retried && !isAuthEndpoint) {
      if (getRefreshToken()) {
        original._retried = true;
        try {
          if (!refreshInFlight) {
            refreshInFlight = axios
              .post(`${baseURL}/auth/refresh`, { refreshToken: getRefreshToken() })
              .finally(() => {
                refreshInFlight = null;
              });
          }
          const { data } = await refreshInFlight;
          setTokens({ accessToken: data.accessToken });
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return client(original);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      } else {
        clearTokens();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
