/**
 * Authentication API Client
 * All authentication-related API endpoints
 */

import apiClient from './axios';
import {
  User,
  AuthResponse,
  RegisterData,
  LoginData,
  RegisterResponse,
  MessageResponse,
  LogoutAllResponse,
  UpdateProfileData,
  ChangePasswordData,
  SessionsResponse,
  SubdomainCheckResponse,
} from '@/lib/types/auth';
import { setTokens, clearTokens } from '@/lib/utils/token';

/**
 * Register a new user and tenant
 */
export async function register(data: RegisterData): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', data);
  return response.data;
}

/**
 * Login with email and password
 */
export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);

  // Store tokens
  const { access_token, refresh_token, expires_in } = response.data;
  setTokens(access_token, refresh_token, expires_in);

  return response.data;
}

/**
 * Refresh access token
 */
export async function refresh(): Promise<{ access_token: string; expires_in: number }> {
  const response = await apiClient.post<{ access_token: string; token_type: string; expires_in: number }>(
    '/auth/refresh'
  );
  return response.data;
}

/**
 * Logout current session
 */
export async function logout(): Promise<MessageResponse> {
  try {
    const response = await apiClient.post<MessageResponse>('/auth/logout');
    clearTokens();
    return response.data;
  } catch (error) {
    // Clear tokens even if request fails
    clearTokens();
    throw error;
  }
}

/**
 * Logout all sessions (all devices)
 */
export async function logoutAll(): Promise<LogoutAllResponse> {
  try {
    const response = await apiClient.post<LogoutAllResponse>('/auth/logout-all');
    clearTokens();
    return response.data;
  } catch (error) {
    // Clear tokens even if request fails
    clearTokens();
    throw error;
  }
}

/**
 * Request password reset email
 */
export async function forgotPassword(email: string): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>('/auth/forgot-password', { email });
  return response.data;
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, password: string): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>('/auth/reset-password', {
    token,
    password,
  });
  return response.data;
}

/**
 * Activate account with token
 */
export async function activateAccount(token: string): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>('/auth/activate', { token });
  return response.data;
}

/**
 * Resend activation email
 */
export async function resendActivation(email: string): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>('/auth/resend-activation', { email });
  return response.data;
}

/**
 * Get current user profile
 */
export async function getProfile(): Promise<User> {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
}

/**
 * Update current user profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<User> {
  const response = await apiClient.patch<User>('/auth/me', data);
  return response.data;
}

/**
 * Change password (authenticated user)
 */
export async function changePassword(data: ChangePasswordData): Promise<MessageResponse> {
  const response = await apiClient.patch<MessageResponse>('/auth/change-password', data);
  return response.data;
}

/**
 * List active sessions
 */
export async function listSessions(): Promise<SessionsResponse> {
  const response = await apiClient.get<SessionsResponse>('/auth/sessions');
  return response.data;
}

/**
 * Revoke specific session
 */
export async function revokeSession(sessionId: string): Promise<MessageResponse> {
  const response = await apiClient.delete<MessageResponse>(`/auth/sessions/${sessionId}`);
  return response.data;
}

/**
 * Check subdomain availability
 */
export async function checkSubdomain(subdomain: string): Promise<SubdomainCheckResponse> {
  const response = await apiClient.get<SubdomainCheckResponse>(`/auth/check-subdomain/${subdomain}`);
  return response.data;
}

/**
 * Auth API object (alternative export style)
 */
export const authApi = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  activateAccount,
  resendActivation,
  getProfile,
  updateProfile,
  changePassword,
  listSessions,
  revokeSession,
  checkSubdomain,
};

export default authApi;
