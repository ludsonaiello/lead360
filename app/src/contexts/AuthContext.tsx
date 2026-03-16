/**
 * Authentication Context
 * Global state management for user authentication
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, LoginData, RegisterData } from '@/lib/types/auth';
import * as authApi from '@/lib/api/auth';
import { isAuthenticated, isTokenExpiringSoon, clearTokens } from '@/lib/utils/token';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Fetch current user profile
   */
  const fetchUser = useCallback(async () => {
    try {
      const authenticated = isAuthenticated();

      if (!authenticated) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userData = await authApi.getProfile();

      console.log('[AUTH] User profile loaded', {
        userId: userData.id,
        email: userData.email,
        tenantId: userData.tenant_id,
        roles: userData.roles,
        isPlatformAdmin: userData.is_platform_admin,
        timestamp: new Date().toISOString(),
      });

      setUser(userData);
    } catch (error) {
      console.error('[AuthContext] Failed to fetch user:', error);
      setUser(null);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check if current route is public (no auth required)
   */
  const isPublicRoute = pathname?.startsWith('/public') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/invite');

  console.log('[AUTH CONTEXT] Route check:', {
    pathname,
    isPublicRoute,
    timestamp: new Date().toISOString()
  });

  /**
   * Initialize auth state on mount
   * Skip for public routes
   */
  useEffect(() => {
    console.log('[AUTH CONTEXT] Init useEffect triggered:', {
      isPublicRoute,
      pathname,
      timestamp: new Date().toISOString()
    });

    if (!isPublicRoute) {
      console.log('[AUTH CONTEXT] >>> FETCHING USER (protected route)');
      fetchUser();
    } else {
      console.log('[AUTH CONTEXT] >>> SKIPPING AUTH - PUBLIC ROUTE DETECTED <<<');
      setIsLoading(false);
    }
  }, [fetchUser, isPublicRoute]);

  /**
   * Auto token refresh
   * Check every minute if token needs refresh
   * Skip for public routes
   */
  useEffect(() => {
    console.log('[AUTH CONTEXT] Token refresh useEffect:', {
      isPublicRoute,
      pathname,
      timestamp: new Date().toISOString()
    });

    if (isPublicRoute) {
      console.log('[AUTH CONTEXT] >>> SKIPPING TOKEN REFRESH - PUBLIC ROUTE <<<');
      return; // No auth logic on public routes
    }

    console.log('[AUTH CONTEXT] Setting up token refresh interval (protected route)');

    const interval = setInterval(async () => {
      if (isAuthenticated() && isTokenExpiringSoon(5)) {
        try {
          await authApi.refresh();
        } catch (error) {
          console.error('[AUTH CONTEXT] !!! TOKEN REFRESH FAILED, REDIRECTING TO LOGIN !!!');
          console.error(error);
          // Token refresh failed, logout user
          clearTokens();
          setUser(null);
          router.push('/login?session_expired=true');
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [router, isPublicRoute]);

  /**
   * Login user
   */
  const login = async (data: LoginData) => {
    try {
      console.log('[AUTH CONTEXT] Login started');
      const response = await authApi.login(data);
      setUser(response.user);
      console.log('[AUTH CONTEXT] Login successful, redirecting to /dashboard');
      router.push('/dashboard');
    } catch (error) {
      console.error('[AUTH CONTEXT] Login failed:', error);
      throw error;
    }
  };

  /**
   * Logout current session
   */
  const logout = async () => {
    try {
      console.log('[AUTH CONTEXT] !!! LOGOUT STARTED - WILL REDIRECT TO /login !!!');
      await authApi.logout();
    } catch (error) {
      console.error('[AUTH CONTEXT] Logout error:', error);
    } finally {
      setUser(null);
      console.log('[AUTH CONTEXT] !!! REDIRECTING TO /login !!!');
      router.push('/login');
    }
  };

  /**
   * Logout all sessions
   */
  const logoutAll = async () => {
    try {
      console.log('[AUTH CONTEXT] !!! LOGOUT ALL STARTED - WILL REDIRECT TO /login !!!');
      await authApi.logoutAll();
    } catch (error) {
      console.error('[AUTH CONTEXT] Logout all error:', error);
    } finally {
      setUser(null);
      console.log('[AUTH CONTEXT] !!! REDIRECTING TO /login !!!');
      router.push('/login');
    }
  };

  /**
   * Register new user
   */
  const register = async (data: RegisterData) => {
    await authApi.register(data);
    // Note: Don't login automatically - user must activate account first
  };

  /**
   * Refresh user data
   */
  const refreshUser = async () => {
    await fetchUser();
  };

  /**
   * Update user state (after profile update)
   */
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    logoutAll,
    register,
    refreshUser,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;
