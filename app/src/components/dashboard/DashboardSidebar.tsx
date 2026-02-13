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
  UserPlus,
  Webhook,
  Mail,
  MessageSquare,
  Send,
  Calculator,
  Library,
  ShoppingCart,
  Package,
  BarChart3,
  Tags,
  Phone,
  Activity,
  Clock,
  TrendingUp,
  DollarSign,
  Server,
  Mic,
  Headset,
} from 'lucide-react';
import ProtectedMenuItem from '@/components/rbac/shared/ProtectedMenuItem';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { getPendingApprovals } from '@/lib/api/quote-approvals';

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
  badge?: number; // Optional badge count (for dynamic counts like pending approvals)
}

interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: (NavItem | NavGroup)[]; // Support nested groups
  permission?: string;
}

const navigation: (NavItem | NavGroup)[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: UserPlus, permission: 'leads:view' },
  { name: 'Customers', href: '/customers', icon: Users, permission: 'users:view' },
  {
    name: 'Quotes',
    icon: Calculator,
    permission: 'quotes:view',
    items: [
      { name: 'All Quotes', href: '/quotes', icon: FileText, permission: 'quotes:view' },
      { name: 'Dashboard', href: '/quotes/dashboard', icon: BarChart3, permission: 'quotes:view' },
      { name: 'Approvals', href: '/approvals', icon: Shield, permission: 'quotes:view' },
      { name: 'Library', href: '/library/items', icon: Library, permission: 'quotes:view' },
      { name: 'Bundles', href: '/library/bundles', icon: Package, permission: 'quotes:view' },
      { name: 'Vendors', href: '/vendors', icon: ShoppingCart, permission: 'quotes:view' },
      { name: 'Tags', href: '/settings/tags', icon: Tags, permission: 'quotes:view' },
      { name: 'Warranty Tiers', href: '/settings/warranty-tiers', icon: Shield, permission: 'quotes:view' },
      { name: 'Quote Settings', href: '/settings/quotes', icon: Settings, permission: 'quotes:edit' },
    ],
  },
  {
    name: 'Communications',
    icon: Mail,
    permission: 'communications:view',
    items: [
      { name: 'History', href: '/communications/history', icon: Send, permission: 'communications:view' },
      { name: 'Templates', href: '/communications/templates', icon: FileText, permission: 'communications:view' },
      { name: 'Notifications', href: '/communications/notifications', icon: Bell, permission: 'communications:view' },
      { name: 'Notification Rules', href: '/communications/notification-rules', icon: MessageSquare, permission: 'communications:edit' },
      {
        name: 'Twilio',
        icon: Phone,
        permission: 'communications:view',
        items: [
          { name: 'Dashboard', href: '/communications/twilio', icon: LayoutDashboard, permission: 'communications:view' },
          { name: 'SMS', href: '/communications/twilio/sms', icon: MessageSquare, permission: 'communications:edit' },
          { name: 'WhatsApp', href: '/communications/twilio/whatsapp', icon: MessageSquare, permission: 'communications:edit' },
          { name: 'Call History', href: '/communications/twilio/calls', icon: Phone, permission: 'communications:view' },
          { name: 'IVR', href: '/communications/twilio/ivr', icon: Mic, permission: 'communications:edit' },
          { name: 'Office Bypass', href: '/communications/twilio/whitelist', icon: Shield, permission: 'communications:edit' },
          { name: 'API Test', href: '/communications/twilio/api-test', icon: Activity, permission: 'communications:view' },
        ],
      },
      { name: 'Settings', href: '/communications/settings', icon: Settings, permission: 'communications:edit' },
    ],
  },
  { name: 'Documents', href: '/documents', icon: FileText, permission: 'documents:view' },
  { name: 'Media', href: '/files', icon: Image, permission: 'files:view' },
  { name: 'Business Settings', href: '/settings/business', icon: Building2, permission: 'settings:edit' },
  { name: 'Webhooks', href: '/settings/webhooks', icon: Webhook, permission: 'leads:edit' },
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
    name: 'Communications',
    icon: Mail,
    permission: 'platform_admin:view_all_tenants',
    items: [
      { name: 'Templates', href: '/admin/communications/templates', icon: FileText, permission: 'platform_admin:view_all_tenants' },
      { name: 'Providers', href: '/admin/communications/providers', icon: Layers, permission: 'platform_admin:view_all_tenants' },
      { name: 'Email Configuration', href: '/admin/communications/email-config', icon: Settings, permission: 'platform_admin:view_all_tenants' },
      {
        name: 'Twilio',
        icon: Phone,
        permission: 'platform_admin:view_all_tenants',
        items: [
          { name: 'Dashboard', href: '/admin/communications/twilio', icon: LayoutDashboard, permission: 'platform_admin:view_all_tenants' },
          {
            name: 'Monitoring',
            icon: Activity,
            permission: 'platform_admin:view_all_tenants',
            items: [
              { name: 'Calls', href: '/admin/communications/twilio/calls', icon: Phone, permission: 'platform_admin:view_all_tenants' },
              { name: 'Messages', href: '/admin/communications/twilio/messages', icon: MessageSquare, permission: 'platform_admin:view_all_tenants' },
              { name: 'Transcriptions', href: '/admin/communications/twilio/transcriptions', icon: FileText, permission: 'platform_admin:view_all_tenants' },
            ],
          },
          {
            name: 'Resources',
            icon: Server,
            permission: 'platform_admin:view_all_tenants',
            items: [
              { name: 'Phone Numbers', href: '/admin/communications/twilio/phone-numbers', icon: Phone, permission: 'platform_admin:view_all_tenants' },
              { name: 'Webhooks', href: '/admin/communications/twilio/webhooks', icon: Webhook, permission: 'platform_admin:view_all_tenants' },
              { name: 'Transcription Providers', href: '/admin/communications/twilio/transcription-providers', icon: Mic, permission: 'platform_admin:view_all_tenants' },
            ],
          },
          {
            name: 'Analytics',
            icon: BarChart3,
            permission: 'platform_admin:view_all_tenants',
            items: [
              { name: 'Metrics', href: '/admin/communications/twilio/metrics', icon: TrendingUp, permission: 'platform_admin:view_all_tenants' },
              { name: 'Usage & Billing', href: '/admin/communications/twilio/usage', icon: DollarSign, permission: 'platform_admin:view_all_tenants' },
            ],
          },
          {
            name: 'Tenants',
            icon: Building2,
            permission: 'platform_admin:view_all_tenants',
            items: [
              { name: 'Configurations', href: '/admin/communications/twilio/tenants', icon: Building2, permission: 'platform_admin:view_all_tenants' },
              { name: 'Tenant Assistance', href: '/admin/communications/twilio/tenant-assistance', icon: Headset, permission: 'platform_admin:view_all_tenants' },
            ],
          },
          {
            name: 'System',
            icon: Cog,
            permission: 'platform_admin:view_all_tenants',
            items: [
              { name: 'Health', href: '/admin/communications/twilio/health', icon: Activity, permission: 'platform_admin:view_all_tenants' },
              { name: 'System Alerts', href: '/admin/communications/twilio/alerts', icon: Bell, permission: 'platform_admin:view_all_tenants' },
              { name: 'Provider Settings', href: '/admin/communications/twilio/provider', icon: Cog, permission: 'platform_admin:view_all_tenants' },
              { name: 'Cron Jobs', href: '/admin/communications/twilio/cron', icon: Clock, permission: 'platform_admin:view_all_tenants' },
              { name: 'Bulk Operations', href: '/admin/communications/twilio/bulk-operations', icon: Server, permission: 'platform_admin:view_all_tenants' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Quotes Admin',
    icon: Calculator,
    permission: 'platform_admin:view_all_tenants',
    items: [
      { name: 'Dashboard', href: '/admin/quotes', icon: LayoutDashboard, permission: 'platform_admin:view_all_tenants' },
      { name: 'Analytics', href: '/admin/quotes/analytics', icon: BarChart3, permission: 'platform_admin:view_all_tenants' },
      { name: 'Templates', href: '/admin/quotes/templates', icon: FileText, permission: 'platform_admin:view_all_tenants' },
      { name: 'Tenants', href: '/admin/quotes/tenants', icon: Building2, permission: 'platform_admin:view_all_tenants' },
      { name: 'Operations', href: '/admin/quotes/operational', icon: Cog, permission: 'platform_admin:view_all_tenants' },
      { name: 'Reports', href: '/admin/quotes/reports', icon: BarChart3, permission: 'platform_admin:view_all_tenants' },
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

  // Pending approvals count
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  /**
   * Recursively find all parent groups of active items
   */
  const findActiveParents = (items: (NavItem | NavGroup)[], parents: string[] = []): string[] => {
    const activeParents: string[] = [];

    items.forEach(item => {
      if ('href' in item) {
        // If this is an active item, add all parents
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          activeParents.push(...parents);
        }
      } else {
        // Check nested groups recursively
        const nestedParents = findActiveParents(item.items, [...parents, item.name]);
        activeParents.push(...nestedParents);
      }
    });

    return activeParents;
  };

  // State for expanded groups - auto-expand based on active route
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    const allGroups = [...navigation, ...adminNavigationGroups];
    const activeParents = findActiveParents(allGroups);
    activeParents.forEach(parent => expanded.add(parent));
    return expanded;
  });

  // Update expanded groups when pathname changes
  useEffect(() => {
    const newExpanded = new Set<string>();
    const allGroups = [...navigation, ...adminNavigationGroups];
    const activeParents = findActiveParents(allGroups);
    activeParents.forEach(parent => newExpanded.add(parent));
    setExpandedGroups(newExpanded);
  }, [pathname]);

  // Fetch pending approvals count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await getPendingApprovals();
        setPendingApprovalsCount(response.count || 0);
      } catch (error) {
        console.error('[SIDEBAR] Failed to fetch pending approvals:', error);
        setPendingApprovalsCount(0);
      }
    };

    // Only fetch pending approvals if:
    // 1. User is in tenant menu (not platform admin or is impersonating)
    // 2. User is NOT an Admin (Admins don't need approval workflow, but Owners do)
    const isAdmin = user?.roles?.some((role: any) => role.name === 'Admin') || false;

    if (showTenantMenu && !isAdmin) {
      fetchPendingCount();
      // Refresh count every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [showTenantMenu, user]);

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

    // Get badge count for Approvals menu item (hide for Admin users)
    const isAdmin = user?.roles?.some((role: any) => role.name === 'Admin') || false;
    const badgeCount = (item.href === '/approvals' && !isAdmin) ? pendingApprovalsCount : 0;

    const linkContent = (
      <Link
        href={item.href}
        className={`
          group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
          transition-all duration-200 relative
          ${collapsed ? 'justify-center' : 'justify-between'}
          ${
            isActive
              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
          }
        `}
        title={collapsed ? item.name : ''}
      >
        <div className="flex items-center gap-x-3">
          <Icon
            className={`h-6 w-6 shrink-0 ${
              isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
            }`}
          />
          {!collapsed && <span>{item.name}</span>}
        </div>
        {!collapsed && badgeCount > 0 && (
          <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {badgeCount}
          </span>
        )}
        {collapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {item.name}
            {badgeCount > 0 && ` (${badgeCount})`}
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
   * Check if a group has any active child (recursively)
   */
  const hasActiveChildRecursive = (items: (NavItem | NavGroup)[]): boolean => {
    return items.some(child => {
      if ('href' in child) {
        return pathname === child.href || pathname.startsWith(child.href + '/');
      } else {
        return hasActiveChildRecursive(child.items);
      }
    });
  };

  /**
   * Render a navigation group (expandable) or single item
   */
  const renderNavItemOrGroup = (item: NavItem | NavGroup, collapsed: boolean = false, depth: number = 0) => {
    // If it's a single NavItem
    if ('href' in item) {
      return renderNavItem(item, collapsed);
    }

    // It's a NavGroup - expandable section
    const group = item as NavGroup;
    const isExpanded = expandedGroups.has(group.name);
    const hasActiveChild = hasActiveChildRecursive(group.items);
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

        {/* Group items - shown when expanded (recursive rendering for nested groups) */}
        {!collapsed && isExpanded && (
          <ul className="mt-1 ml-4 space-y-1">
            {group.items.map((childItem) => renderNavItemOrGroup(childItem, false, depth + 1))}
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
  const renderNavItemOrGroupMobile = (item: NavItem | NavGroup, depth: number = 0) => {
    // If it's a single NavItem
    if ('href' in item) {
      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
      const Icon = item.icon;

      // Get badge count for Approvals menu item (hide for Admin users)
      const isAdmin = user?.roles?.some((role: any) => role.name === 'Admin') || false;
      const badgeCount = (item.href === '/approvals' && !isAdmin) ? pendingApprovalsCount : 0;

      const linkContent = (
        <Link
          href={item.href}
          onClick={onClose}
          className={`
            group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6
            transition-all duration-200 justify-between
            ${
              isActive
                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-brand-600 dark:hover:text-brand-400'
            }
          `}
        >
          <div className="flex items-center gap-x-3">
            <Icon
              className={`h-6 w-6 shrink-0 ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-brand-400'
              }`}
            />
            {item.name}
          </div>
          {badgeCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
              {badgeCount}
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
    }

    // It's a NavGroup - expandable section
    const group = item as NavGroup;
    const isExpanded = expandedGroups.has(group.name);
    const hasActiveChild = hasActiveChildRecursive(group.items);
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

        {/* Group items - shown when expanded (recursive rendering) */}
        {isExpanded && (
          <ul className="mt-1 ml-4 space-y-1">
            {group.items.map((childItem) => renderNavItemOrGroupMobile(childItem, depth + 1))}
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
                    {navigation.map((item) => renderNavItemOrGroup(item, isCollapsed))}
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
                    {navigation.map((item) => renderNavItemOrGroupMobile(item))}
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
