/**
 * Dashboard Sidebar Component
 * Navigation menu with icons, collapsible sections, and mobile support
 */

'use client';

import React, { useState, useEffect } from 'react';
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
  Cog,
  Bell,
  Briefcase,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ProtectedMenuItem from '@/components/rbac/shared/ProtectedMenuItem';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string; // Optional permission required to view this menu item
}

interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  permission?: string;
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

// Platform Admin menu groups
const adminNavigationGroups: (NavItem | NavGroup)[] = [
  { name: 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, permission: 'platform_admin:view_all_tenants' },
  { name: 'Notifications', href: '/admin/alerts', icon: Bell, permission: 'platform_admin:view_all_tenants' },
  {
    name: 'Tenants',
    icon: Building2,
    permission: 'platform_admin:view_all_tenants',
    items: [
      { name: 'Tenants', href: '/admin/tenants', icon: Building2, permission: 'platform_admin:view_all_tenants' },
      { name: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard, permission: 'platform_admin:view_all_tenants' },
      { name: 'Industries', href: '/admin/industries', icon: Briefcase, permission: 'platform_admin:view_all_tenants' },
    ],
  },
  {
    name: 'Users',
    icon: Users,
    permission: 'rbac:view',
    items: [
      { name: 'Roles', href: '/admin/rbac/roles', icon: Shield, permission: 'rbac:view' },
      { name: 'Permissions', href: '/admin/rbac/permissions', icon: Key, permission: 'rbac:view' },
      { name: 'Modules', href: '/admin/rbac/modules', icon: Layers, permission: 'rbac:view' },
      { name: 'Templates', href: '/admin/rbac/templates', icon: LayoutTemplate, permission: 'rbac:view' },
    ],
  },
  {
    name: 'System',
    icon: Cog,
    permission: 'platform_admin:view_all_tenants',
    items: [
      { name: 'Background Jobs', href: '/admin/jobs', icon: Cog, permission: 'platform_admin:view_all_tenants' },
      { name: 'All Media', href: '/admin/files', icon: Image, permission: 'platform_admin:view_all_tenants' },
      { name: 'System Audit Log', href: '/admin/audit-logs', icon: ScrollText, permission: 'platform_admin:view_all_tenants' },
    ],
  },
];

export function DashboardSidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isImpersonating } = useImpersonation();

  // Determine which menu sections to show
  const isPlatformAdmin = user?.is_platform_admin || false;
  const showTenantMenu = !isPlatformAdmin || isImpersonating;
  const showAdminMenu = isPlatformAdmin && !isImpersonating;

  // State for expanded groups - auto-expand based on active route
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    adminNavigationGroups.forEach(item => {
      if ('items' in item) {
        const hasActiveChild = item.items.some(child =>
          pathname === child.href || pathname.startsWith(child.href + '/')
        );
        if (hasActiveChild) expanded.add(item.name);
      }
    });
    return expanded;
  });

  // Update expanded groups when pathname changes
  useEffect(() => {
    const newExpanded = new Set(expandedGroups);
    adminNavigationGroups.forEach(item => {
      if ('items' in item) {
        const hasActiveChild = item.items.some(child =>
          pathname === child.href || pathname.startsWith(child.href + '/')
        );
        if (hasActiveChild) {
          newExpanded.add(item.name);
        }
      }
    });
    setExpandedGroups(newExpanded);
  }, [pathname]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  console.log('[SIDEBAR] Menu visibility', {
    isPlatformAdmin,
    isImpersonating,
    showTenantMenu,
    showAdminMenu,
    userTenantId: user?.tenant_id,
  });

  /**
   * Render a navigation item with optional permission check
   */
  const renderNavItem = (item: NavItem, collapsed: boolean = false) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        className={`
          group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
          transition-all duration-200 relative
          ${collapsed ? 'justify-center' : ''}
          ${
            isActive
              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
          }
        `}
        title={collapsed ? item.name : ''}
      >
        <Icon
          className={`h-6 w-6 shrink-0 ${
            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
          }`}
        />
        {!collapsed && <span>{item.name}</span>}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {item.name}
          </span>
        )}
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

  /**
   * Render a navigation group (expandable) or single item
   */
  const renderNavItemOrGroup = (item: NavItem | NavGroup, collapsed: boolean = false) => {
    // If it's a single NavItem
    if ('href' in item) {
      return renderNavItem(item, collapsed);
    }

    // It's a NavGroup - expandable section
    const group = item as NavGroup;
    const isExpanded = expandedGroups.has(group.name);
    const hasActiveChild = group.items.some(child =>
      pathname === child.href || pathname.startsWith(child.href + '/')
    );
    const Icon = group.icon;

    const groupContent = (
      <div key={group.name}>
        {/* Group header - clickable to expand/collapse */}
        <button
          onClick={() => toggleGroup(group.name)}
          className={`
            w-full group flex items-center gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
            transition-all duration-200
            ${collapsed ? 'justify-center' : 'justify-between'}
            ${
              hasActiveChild
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
            }
          `}
          title={collapsed ? group.name : ''}
        >
          <div className="flex items-center gap-x-3">
            <Icon
              className={`h-6 w-6 shrink-0 ${
                hasActiveChild ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
              }`}
            />
            {!collapsed && <span>{group.name}</span>}
          </div>
          {!collapsed && (
            isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )
          )}
        </button>

        {/* Group items - shown when expanded */}
        {!collapsed && isExpanded && (
          <ul className="mt-1 ml-4 space-y-1">
            {group.items.map((childItem) => renderNavItem(childItem, false))}
          </ul>
        )}
      </div>
    );

    if (group.permission) {
      return (
        <ProtectedMenuItem key={group.name} requiredPermission={group.permission}>
          {groupContent}
        </ProtectedMenuItem>
      );
    }

    return <li key={group.name}>{groupContent}</li>;
  };

  /**
   * Render navigation for mobile (never collapsed, with onClose handler)
   */
  const renderNavItemOrGroupMobile = (item: NavItem | NavGroup) => {
    // If it's a single NavItem
    if ('href' in item) {
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
    }

    // It's a NavGroup - expandable section
    const group = item as NavGroup;
    const isExpanded = expandedGroups.has(group.name);
    const hasActiveChild = group.items.some(child =>
      pathname === child.href || pathname.startsWith(child.href + '/')
    );
    const Icon = group.icon;

    const groupContent = (
      <div key={group.name}>
        {/* Group header - clickable to expand/collapse */}
        <button
          onClick={() => toggleGroup(group.name)}
          className={`
            w-full group flex items-center justify-between gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
            transition-all duration-200
            ${
              hasActiveChild
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
            }
          `}
        >
          <div className="flex items-center gap-x-3">
            <Icon
              className={`h-6 w-6 shrink-0 ${
                hasActiveChild ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
              }`}
            />
            <span>{group.name}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {/* Group items - shown when expanded */}
        {isExpanded && (
          <ul className="mt-1 ml-4 space-y-1">
            {group.items.map((childItem) => {
              const isActive = pathname === childItem.href || pathname.startsWith(childItem.href + '/');
              const ChildIcon = childItem.icon;

              const linkContent = (
                <Link
                  href={childItem.href}
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
                  <ChildIcon
                    className={`h-6 w-6 shrink-0 ${
                      isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                    }`}
                  />
                  {childItem.name}
                </Link>
              );

              if (childItem.permission) {
                return (
                  <ProtectedMenuItem key={childItem.name} requiredPermission={childItem.permission}>
                    {linkContent}
                  </ProtectedMenuItem>
                );
              }

              return <li key={childItem.name}>{linkContent}</li>;
            })}
          </ul>
        )}
      </div>
    );

    if (group.permission) {
      return (
        <ProtectedMenuItem key={group.name} requiredPermission={group.permission}>
          {groupContent}
        </ProtectedMenuItem>
      );
    }

    return <li key={group.name}>{groupContent}</li>;
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col z-50 transition-all duration-300 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 px-3 pb-4">
          {/* Logo and Toggle */}
          <div className="flex h-16 shrink-0 items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                Lead360
              </h1>
            )}
            <button
              onClick={onToggleCollapse}
              className={`p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Tenant Navigation - Show when NOT platform admin OR when impersonating */}
              {showTenantMenu && (
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => renderNavItem(item, isCollapsed))}
                  </ul>
                </li>
              )}

              {/* Admin Navigation - Show ONLY when platform admin AND NOT impersonating */}
              {showAdminMenu && (
                <li>
                  {!isCollapsed && (
                    <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-2">
                      Platform Admin
                    </div>
                  )}
                  <ul role="list" className="-mx-2 space-y-1">
                    {adminNavigationGroups.map((item) => renderNavItemOrGroup(item, isCollapsed))}
                  </ul>
                </li>
              )}
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
              {/* Tenant Navigation - Show when NOT platform admin OR when impersonating */}
              {showTenantMenu && (
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
              )}

              {/* Admin Navigation - Show ONLY when platform admin AND NOT impersonating */}
              {showAdminMenu && (
                <li>
                  <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-2">
                    Platform Admin
                  </div>
                  <ul role="list" className="-mx-2 space-y-1">
                    {adminNavigationGroups.map((item) => renderNavItemOrGroupMobile(item))}
                  </ul>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}

export default DashboardSidebar;
