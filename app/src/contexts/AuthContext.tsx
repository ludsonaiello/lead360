/**
 * Authentication Context
 * Global state management for user authentication
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

  /**
   * Fetch current user profile
   */
  const fetchUser = useCallback(async () => {
    try {
      if (!isAuthenticated()) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userData = await authApi.getProfile();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  /**
   * Auto token refresh
   * Check every minute if token needs refresh
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isAuthenticated() && isTokenExpiringSoon(5)) {
        try {
          await authApi.refresh();
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Token refresh failed, logout user
          clearTokens();
          setUser(null);
          router.push('/login?session_expired=true');
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [router]);

  /**
   * Login user
   */
  const login = async (data: LoginData) => {
    try {
      const response = await authApi.login(data);
      setUser(response.user);
      router.push('/dashboard');
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout current session
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  /**
   * Logout all sessions
   */
  const logoutAll = async () => {
    try {
      await authApi.logoutAll();
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      setUser(null);
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
