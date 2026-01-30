/**
 * Configured Axios Client
 * Handles authentication, token refresh, and error handling
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/utils/token';

// Base API URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * Subscribe to token refresh
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers when token is refreshed
 */
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Request interceptor - Add authorization header and impersonation context
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add impersonation headers if in impersonation mode
    if (typeof window !== 'undefined') {
      const impersonatedTenantId = sessionStorage.getItem('impersonatedTenantId');
      const impersonatedTenantName = sessionStorage.getItem('impersonatedTenantName');

      if (impersonatedTenantId && config.headers) {
        config.headers['X-Impersonate-Tenant-Id'] = impersonatedTenantId;

        // Log impersonation requests in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[API REQUEST - IMPERSONATING]', {
            url: `${config.baseURL}${config.url}`,
            method: config.method?.toUpperCase(),
            impersonatedTenantId,
            impersonatedTenantName,
            headers: {
              Authorization: config.headers.Authorization ? `Bearer ${token?.substring(0, 20)}...` : 'None',
              'X-Impersonate-Tenant-Id': impersonatedTenantId,
            },
            params: config.params,
            data: config.data,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (process.env.NODE_ENV === 'development') {
        // Log normal (non-impersonation) requests
        console.log('[API REQUEST - NORMAL]', {
          url: `${config.baseURL}${config.url}`,
          method: config.method?.toUpperCase(),
          headers: {
            Authorization: config.headers?.Authorization ? `Bearer ${token?.substring(0, 20)}...` : 'None',
          },
          params: config.params,
          data: config.data,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors and token refresh
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses in development when impersonating
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const impersonatedTenantId = sessionStorage.getItem('impersonatedTenantId');
      if (impersonatedTenantId) {
        console.log('[API RESPONSE - IMPERSONATING]', {
          url: response.config.url,
          method: response.config.method?.toUpperCase(),
          status: response.status,
          impersonatedTenantId,
          dataPreview: response.data ? JSON.stringify(response.data).substring(0, 200) + '...' : 'No data',
          timestamp: new Date().toISOString(),
        });
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - Token expired or invalid
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      console.log('[AXIOS INTERCEPTOR] 401 Error detected:', {
        url: originalRequest.url,
        timestamp: new Date().toISOString()
      });

      // Avoid refresh for login/register/public endpoints
      const publicEndpoints = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/auth/activate', '/public/share', '/public/quotes'];
      const isPublicEndpoint = publicEndpoints.some((endpoint) =>
        originalRequest.url?.includes(endpoint)
      );

      console.log('[AXIOS INTERCEPTOR] Public endpoint check:', {
        url: originalRequest.url,
        isPublicEndpoint,
        timestamp: new Date().toISOString()
      });

      if (isPublicEndpoint) {
        console.log('[AXIOS INTERCEPTOR] Public endpoint - skipping token refresh');
        return Promise.reject(error);
      }

      // Mark request as retried
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshToken = getRefreshToken();

          console.log('[AXIOS INTERCEPTOR] Attempting token refresh:', {
            hasRefreshToken: !!refreshToken,
            timestamp: new Date().toISOString()
          });

          if (!refreshToken) {
            // No refresh token, redirect to login
            console.log('[AXIOS INTERCEPTOR] !!! NO REFRESH TOKEN - REDIRECTING TO /login !!!');
            console.log('[AXIOS INTERCEPTOR] Current pathname:', typeof window !== 'undefined' ? window.location.pathname : 'SSR');
            clearTokens();
            if (typeof window !== 'undefined') {
              console.log('[AXIOS INTERCEPTOR] !!! window.location.href = "/login?session_expired=true" !!!');
              window.location.href = '/login?session_expired=true';
            }
            return Promise.reject(error);
          }

          // Attempt to refresh token
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            {
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
            }
          );

          const { access_token, expires_in } = response.data;

          // Store new tokens
          setTokens(access_token, refreshToken, expires_in);

          // Notify all waiting requests
          onTokenRefreshed(access_token);

          isRefreshing = false;

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          console.error('[AXIOS INTERCEPTOR] !!! TOKEN REFRESH FAILED !!!');
          console.error('[AXIOS INTERCEPTOR] Error:', refreshError);
          isRefreshing = false;
          clearTokens();

          if (typeof window !== 'undefined') {
            console.log('[AXIOS INTERCEPTOR] !!! window.location.href = "/login?session_expired=true" !!!');
            console.log('[AXIOS INTERCEPTOR] Current pathname:', window.location.pathname);
            window.location.href = '/login?session_expired=true';
          }

          return Promise.reject(refreshError);
        }
      } else {
        // Wait for token refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }
    }

    // Handle other errors
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      // Log errors for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('API Error:', {
          status,
          url: originalRequest?.url,
          data,
        });

        // Special logging for 403 errors
        if (status === 403) {
          console.error('[Axios] 403 Forbidden Error Details:', {
            url: originalRequest?.url,
            method: originalRequest?.method,
            headers: originalRequest?.headers,
            errorMessage: data?.message,
            errorDetails: data,
            currentTime: new Date().toISOString()
          });
        }
      }

      // Return structured error
      return Promise.reject({
        status,
        message: data?.message || 'An error occurred',
        error: data?.error || 'Unknown error',
        data,
      });
    } else if (error.request) {
      // Request made but no response received (network error)
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your internet connection.',
        error: 'NetworkError',
      });
    } else {
      // Something else happened
      return Promise.reject({
        status: 0,
        message: error.message || 'An unexpected error occurred',
        error: 'UnknownError',
      });
    }
  }
);

export default apiClient;
