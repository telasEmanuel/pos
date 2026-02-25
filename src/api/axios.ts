import axios from 'axios';
import { useAuthStore } from 'src/stores/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API,
});

api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    const tk = authStore.token;
    if (tk) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${tk}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error instanceof Error ? error : new Error(String(error))),
);

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const apiError = error as {
        response?: { status?: number; data?: unknown; statusText?: string };
        config?: { method?: string; url?: string; data?: unknown };
        message?: string;
      };
      const status = apiError.response?.status;
      const responseData = apiError.response?.data;
      const method = apiError.config?.method?.toUpperCase();
      const url = apiError.config?.url;
      const requestData = apiError.config?.data;

      console.error(`\n${'='.repeat(60)}\n🔴 API ERROR ${status}\n${'='.repeat(60)}`);
      console.error(`📍 ${method} ${url}`);
      console.error(`📤 Request:`, requestData ? JSON.parse(requestData as string) : 'No data');
      console.error(`📥 Response:`, responseData);
      console.error(`${'='.repeat(60)}\n`);

      if (status === 401) {
        const authStore = useAuthStore();
        authStore.logout();
        // Optionally redirect to login
        // window.location.href = '/'
      }

      // Return the actual error object with full context
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new Error(JSON.stringify(error)));
    }
    if (error instanceof Error) {
      return Promise.reject(error);
    }
    return Promise.reject(new Error(JSON.stringify(error)));
  },
);

export default api;
