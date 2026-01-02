/**
 * Authentication Type Definitions
 * Matches backend API documentation exactly
 */

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  tenant_id: string | null;
  roles: string[];
  is_platform_admin: boolean;
  email_verified: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Session {
  id: string;
  device_name: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  tenant_subdomain: string;
  company_name: string;
}

export interface LoginData {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

export interface ActivateAccountData {
  token: string;
}

export interface ResendActivationData {
  email: string;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface SubdomainCheckResponse {
  available: boolean;
  subdomain: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    email_verified: boolean;
  };
  tenant: {
    id: string;
    subdomain: string;
    company_name: string;
  };
  message: string;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface MessageResponse {
  message: string;
}

export interface LogoutAllResponse {
  message: string;
  sessions_revoked: number;
}
