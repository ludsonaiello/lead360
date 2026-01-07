/**
 * Dashboard Sidebar Component
 * Navigation menu with icons, collapsible sections, and mobile support
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  Building2,
  Settings,
  HelpCircle,
  Shield,
  Key,
  Layers,
  LayoutTemplate,
  X,
  ScrollText,
  Image,
} from 'lucide-react';
import ProtectedMenuItem from '@/components/rbac/shared/ProtectedMenuItem';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string; // Optional permission required to view this menu item
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users, permission: 'users:view' },
  { name: 'Documents', href: '/documents', icon: FileText, permission: 'documents:view' },
  { name: 'Media', href: '/files', icon: Image, permission: 'files:view' },
  { name: 'Business Settings', href: '/settings/business', icon: Building2, permission: 'settings:edit' },
  { name: 'Profile Settings', href: '/settings/profile', icon: Settings },
  { name: 'Audit Log', href: '/settings/audit-log', icon: ScrollText, permission: 'audit:view' },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

// Platform Admin menu items
const adminNavigation: NavItem[] = [
  { name: 'Roles', href: '/admin/rbac/roles', icon: Shield, permission: 'rbac:view' },
  { name: 'Permissions', href: '/admin/rbac/permissions', icon: Key, permission: 'rbac:view' },
  { name: 'Modules', href: '/admin/rbac/modules', icon: Layers, permission: 'rbac:view' },
  { name: 'Templates', href: '/admin/rbac/templates', icon: LayoutTemplate, permission: 'rbac:view' },
  { name: 'All Media', href: '/admin/files', icon: Image, permission: 'platform_admin:view_all_tenants' },
  { name: 'System Audit Log', href: '/admin/audit-logs', icon: ScrollText, permission: 'platform_admin:view_all_tenants' },
];

export function DashboardSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  /**
   * Render a navigation item with optional permission check
   */
  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        className={`
          group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
          transition-all duration-200
          ${
            isActive
              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
          }
        `}
      >
        <Icon
          className={`h-6 w-6 shrink-0 ${
            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
          }`}
        />
        {item.name}
      </Link>
    );

    if (item.permission) {
      return (
        <ProtectedMenuItem key={item.name} requiredPermission={item.permission}>
          {linkContent}
        </ProtectedMenuItem>
      );
    }

    return <li key={item.name}>{linkContent}</li>;
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col z-50">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              Lead360
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Main Navigation */}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map(renderNavItem)}
                </ul>
              </li>

              {/* Admin Navigation */}
              <li>
                <ProtectedMenuItem requiredPermission="rbac:view">
                  <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-2">
                    Platform Admin
                  </div>
                  <ul role="list" className="-mx-2 space-y-1">
                    {adminNavigation.map(renderNavItem)}
                  </ul>
                </ProtectedMenuItem>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 lg:hidden
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 px-6 pb-4">
          {/* Mobile header */}
          <div className="flex h-16 shrink-0 items-center justify-between">
            <h1 className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              Lead360
            </h1>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col mt-5 overflow-y-auto">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Main Navigation */}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;

                    const linkContent = (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`
                          group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
                          transition-all duration-200
                          ${
                            isActive
                              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
                          }
                        `}
                      >
                        <Icon
                          className={`h-6 w-6 shrink-0 ${
                            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                          }`}
                        />
                        {item.name}
                      </Link>
                    );

                    if (item.permission) {
                      return (
                        <ProtectedMenuItem key={item.name} requiredPermission={item.permission}>
                          {linkContent}
                        </ProtectedMenuItem>
                      );
                    }

                    return <li key={item.name}>{linkContent}</li>;
                  })}
                </ul>
              </li>

              {/* Admin Navigation */}
              <li>
                <ProtectedMenuItem requiredPermission="rbac:view">
                  <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-2">
                    Platform Admin
                  </div>
                  <ul role="list" className="-mx-2 space-y-1">
                    {adminNavigation.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                      const Icon = item.icon;

                      return (
                        <ProtectedMenuItem key={item.name} requiredPermission={item.permission!}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={`
                              group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
                              transition-all duration-200
                              ${
                                isActive
                                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
                              }
                            `}
                          >
                            <Icon
                              className={`h-6 w-6 shrink-0 ${
                                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                              }`}
                            />
                            {item.name}
                          </Link>
                        </ProtectedMenuItem>
                      );
                    })}
                  </ul>
                </ProtectedMenuItem>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}

export default DashboardSidebar;
