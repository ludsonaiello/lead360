/**
 * Dashboard Header Component
 * Top bar with search, notifications, and user profile menu
 */

'use client';

import React, { useState } from 'react';
import { Menu, Search, Bell, User, LogOut, Settings, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import AlertsBell from '@/components/admin/alerts/AlertsBell';
import NotificationBell from '@/components/communication/NotificationBell';

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Search */}
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <form className="relative flex flex-1" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <Search className="pointer-events-none absolute inset-y-0 left-3 h-full w-5 text-gray-400 dark:text-gray-500" />
            <input
              id="search-field"
              className="block h-full w-full border-0 bg-transparent py-0 pl-11 pr-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-0 sm:text-sm"
              placeholder="Search..."
              type="search"
              name="search"
            />
          </form>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          {/* Admin Alerts (only for platform admins) */}
          {user?.is_platform_admin && <AlertsBell />}

          {/* User Notifications Bell */}
          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-x-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <span className="hidden lg:block">
                {user?.first_name} {user?.last_name}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </button>

            {/* Profile dropdown menu */}
            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-soft-lg ring-1 ring-black/5 dark:ring-gray-700">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-x-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <User className="h-4 w-4" />
                      Your Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-x-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-x-3 px-4 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
