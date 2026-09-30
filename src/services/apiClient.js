import axios from 'axios';

// Instancia central de Axios con interceptores para adjuntar el JWT
// y normalizar errores de autenticación (401 -> limpia sesión).

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export const TOKEN_STORAGE_KEY = 'blueprints_jwt_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage puede no estar disponible (SSR/tests); se ignora.
  }
}

const httpClient = axios.create({ baseURL });

httpClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setStoredToken(null);
    }
    return Promise.reject(error);
  }
);

export default httpClient;
