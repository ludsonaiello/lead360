import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * RBAC Seed Data
 *
 * Seeds the database with:
 * 1. Modules (14 platform features)
 * 2. Permissions (actions per module)
 * 3. Role Templates (7 default templates)
 * 4. Template Permissions (link templates to permissions)
 *
 * Idempotent: Can be run multiple times safely
 */

// ============================================
// MODULE DEFINITIONS
// ============================================

const modules = [
  { name: 'dashboard', display_name: 'Dashboard', description: 'Main dashboard and analytics overview', sort_order: 1, icon: 'dashboard' },
  { name: 'leads', display_name: 'Lead Management', description: 'Manage leads and prospects', sort_order: 2, icon: 'users' },
  { name: 'quotes', display_name: 'Quote Builder', description: 'Create and manage quotes', sort_order: 3, icon: 'file-text' },
  { name: 'projects', display_name: 'Project Management', description: 'Manage projects and workflows', sort_order: 4, icon: 'briefcase' },
  { name: 'tasks', display_name: 'Task Management', description: 'Manage tasks and assignments', sort_order: 5, icon: 'check-square' },
  { name: 'invoices', display_name: 'Invoice Management', description: 'Create and manage invoices', sort_order: 6, icon: 'file-invoice' },
  { name: 'payments', display_name: 'Payment Processing', description: 'Track and process payments', sort_order: 7, icon: 'credit-card' },
  { name: 'expenses', display_name: 'Expense Tracking', description: 'Track business expenses', sort_order: 8, icon: 'receipt' },
  { name: 'reports', display_name: 'Reports & Analytics', description: 'View and export reports', sort_order: 9, icon: 'chart-bar' },
  { name: 'calendar', display_name: 'Calendar & Scheduling', description: 'Manage schedules and appointments', sort_order: 10, icon: 'calendar' },
  { name: 'timeclock', display_name: 'Time Clock', description: 'Employee time tracking', sort_order: 11, icon: 'clock' },
  { name: 'users', display_name: 'User Management', description: 'Manage users and roles', sort_order: 12, icon: 'users-cog' },
  { name: 'settings', display_name: 'Business Settings', description: 'Configure business settings', sort_order: 13, icon: 'cog' },
  { name: 'subscription', display_name: 'Subscription & Billing', description: 'Manage subscription and billing', sort_order: 14, icon: 'credit-card-alt' },
];

// ============================================
// PERMISSION DEFINITIONS (per module)
// ============================================

const modulePermissions: Record<string, Array<{ action: string; display_name: string; description?: string }>> = {
  dashboard: [
    { action: 'view', display_name: 'View Dashboard', description: 'View dashboard and analytics' },
  ],
  leads: [
    { action: 'view', display_name: 'View Leads', description: 'View leads and their details' },
    { action: 'create', display_name: 'Create Leads', description: 'Create new leads' },
    { action: 'edit', display_name: 'Edit Leads', description: 'Edit existing leads' },
    { action: 'delete', display_name: 'Delete Leads', description: 'Delete leads' },
    { action: 'export', display_name: 'Export Leads', description: 'Export leads to CSV/PDF' },
  ],
  quotes: [
    { action: 'view', display_name: 'View Quotes', description: 'View quotes and their details' },
    { action: 'create', display_name: 'Create Quotes', description: 'Create new quotes' },
    { action: 'edit', display_name: 'Edit Quotes', description: 'Edit existing quotes' },
    { action: 'delete', display_name: 'Delete Quotes', description: 'Delete quotes' },
    { action: 'send', display_name: 'Send Quotes', description: 'Send quotes to customers' },
    { action: 'approve', display_name: 'Approve Quotes', description: 'Approve quotes before sending' },
    { action: 'export', display_name: 'Export Quotes', description: 'Export quotes to PDF' },
  ],
  projects: [
    { action: 'view', display_name: 'View Projects', description: 'View projects and their details' },
    { action: 'create', display_name: 'Create Projects', description: 'Create new projects' },
    { action: 'edit', display_name: 'Edit Projects', description: 'Edit existing projects' },
    { action: 'delete', display_name: 'Delete Projects', description: 'Delete projects' },
    { action: 'export', display_name: 'Export Projects', description: 'Export project data' },
  ],
  tasks: [
    { action: 'view', display_name: 'View Tasks', description: 'View tasks and their details' },
    { action: 'create', display_name: 'Create Tasks', description: 'Create new tasks' },
    { action: 'edit', display_name: 'Edit Tasks', description: 'Edit existing tasks' },
    { action: 'delete', display_name: 'Delete Tasks', description: 'Delete tasks' },
    { action: 'assign', display_name: 'Assign Tasks', description: 'Assign tasks to users' },
  ],
  invoices: [
    { action: 'view', display_name: 'View Invoices', description: 'View invoices and their details' },
    { action: 'create', display_name: 'Create Invoices', description: 'Create new invoices' },
    { action: 'edit', display_name: 'Edit Invoices', description: 'Edit existing invoices' },
    { action: 'delete', display_name: 'Delete Invoices', description: 'Delete invoices' },
    { action: 'send', display_name: 'Send Invoices', description: 'Send invoices to customers' },
    { action: 'export', display_name: 'Export Invoices', description: 'Export invoices to PDF' },
  ],
  payments: [
    { action: 'view', display_name: 'View Payments', description: 'View payment records' },
    { action: 'create', display_name: 'Record Payments', description: 'Record new payments' },
    { action: 'edit', display_name: 'Edit Payments', description: 'Edit payment records' },
    { action: 'delete', display_name: 'Delete Payments', description: 'Delete payment records' },
    { action: 'export', display_name: 'Export Payments', description: 'Export payment data' },
  ],
  expenses: [
    { action: 'view', display_name: 'View Expenses', description: 'View expense records' },
    { action: 'create', display_name: 'Create Expenses', description: 'Create new expenses' },
    { action: 'edit', display_name: 'Edit Expenses', description: 'Edit existing expenses' },
    { action: 'delete', display_name: 'Delete Expenses', description: 'Delete expenses' },
    { action: 'export', display_name: 'Export Expenses', description: 'Export expense data' },
  ],
  reports: [
    { action: 'view', display_name: 'View Reports', description: 'View all reports' },
    { action: 'export', display_name: 'Export Reports', description: 'Export reports to CSV/PDF' },
  ],
  calendar: [
    { action: 'view', display_name: 'View Calendar', description: 'View calendar and appointments' },
    { action: 'create', display_name: 'Create Events', description: 'Create calendar events' },
    { action: 'edit', display_name: 'Edit Events', description: 'Edit calendar events' },
    { action: 'delete', display_name: 'Delete Events', description: 'Delete calendar events' },
  ],
  timeclock: [
    { action: 'view', display_name: 'View Time Entries', description: 'View time clock entries' },
    { action: 'clock_in', display_name: 'Clock In', description: 'Clock in for work' },
    { action: 'clock_out', display_name: 'Clock Out', description: 'Clock out from work' },
    { action: 'edit', display_name: 'Edit Time Entries', description: 'Edit time clock entries' },
    { action: 'delete', display_name: 'Delete Time Entries', description: 'Delete time clock entries' },
  ],
  users: [
    { action: 'view', display_name: 'View Users', description: 'View user list and details' },
    { action: 'create', display_name: 'Create Users', description: 'Create new users' },
    { action: 'edit', display_name: 'Edit Users', description: 'Edit user information' },
    { action: 'delete', display_name: 'Delete Users', description: 'Delete users' },
    { action: 'manage_roles', display_name: 'Manage Roles', description: 'Assign and remove user roles' },
  ],
  settings: [
    { action: 'view', display_name: 'View Settings', description: 'View business settings' },
    { action: 'edit', display_name: 'Edit Settings', description: 'Edit business settings' },
  ],
  subscription: [
    { action: 'view', display_name: 'View Subscription', description: 'View subscription details' },
    { action: 'edit', display_name: 'Manage Subscription', description: 'Change subscription plan and billing' },
  ],
};

// ============================================
// ROLE TEMPLATE DEFINITIONS
// ============================================

const roleTemplates = [
  {
    name: 'Owner',
    description: 'Full access to all features including billing and subscription management',
    is_system_template: true,
    permissions: 'ALL', // Special marker - will get all permissions
  },
  {
    name: 'Admin',
    description: 'Administrative access to all features except billing and subscription',
    is_system_template: true,
    permissions: 'ALL_EXCEPT', // All except subscription module
    except_modules: ['subscription'],
  },
  {
    name: 'Estimator',
    description: 'Create and manage quotes, estimates, and service requests',
    is_system_template: true,
    permissions: [
      'dashboard:view',
      'leads:view', 'leads:create', 'leads:edit',
      'quotes:view', 'quotes:create', 'quotes:edit', 'quotes:send',
      'projects:view', 'projects:create',
      'calendar:view', 'calendar:edit',
    ],
  },
  {
    name: 'Project Manager',
    description: 'Manage active projects, tasks, and schedules',
    is_system_template: true,
    permissions: [
      'dashboard:view',
      'leads:view',
      'quotes:view',
      'projects:view', 'projects:create', 'projects:edit',
      'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:assign',
      'calendar:view', 'calendar:create', 'calendar:edit',
      'reports:view',
    ],
  },
  {
    name: 'Bookkeeper',
    description: 'Manage all financial operations including invoices, payments, and expenses',
    is_system_template: true,
    permissions: [
      'dashboard:view',
      'leads:view',
      'quotes:view',
      'projects:view',
      'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:send', 'invoices:export',
      'payments:view', 'payments:create', 'payments:edit', 'payments:export',
      'expenses:view', 'expenses:create', 'expenses:edit', 'expenses:export',
      'reports:view', 'reports:export',
    ],
  },
  {
    name: 'Employee',
    description: 'Limited access for field workers - clock in/out and view assigned tasks',
    is_system_template: true,
    permissions: [
      'timeclock:view', 'timeclock:clock_in', 'timeclock:clock_out',
      'tasks:view', 'tasks:edit', // Can edit their own tasks (status updates)
      'calendar:view',
    ],
  },
  {
    name: 'Read-only',
    description: 'View-only access for stakeholders, investors, or auditors',
    is_system_template: true,
    permissions: [
      'dashboard:view',
      'reports:view', 'reports:export',
    ],
  },
];

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedModules() {
  console.log('📦 Seeding modules...');

  for (const module of modules) {
    await prisma.module.upsert({
      where: { name: module.name },
      update: {
        display_name: module.display_name,
        description: module.description,
        sort_order: module.sort_order,
        icon: module.icon,
      },
      create: {
        id: randomBytes(16).toString('hex'),
        ...module,
      },
    });
  }

  console.log(`✅ Seeded ${modules.length} modules`);
}

async function seedPermissions() {
  console.log('🔑 Seeding permissions...');

  let totalPermissions = 0;

  for (const [moduleName, permissions] of Object.entries(modulePermissions)) {
    const module = await prisma.module.findUnique({
      where: { name: moduleName },
    });

    if (!module) {
      console.warn(`⚠️  Module "${moduleName}" not found, skipping permissions`);
      continue;
    }

    for (const permission of permissions) {
      await prisma.permission.upsert({
        where: {
          module_id_action: {
            module_id: module.id,
            action: permission.action,
          },
        },
        update: {
          display_name: permission.display_name,
          description: permission.description,
        },
        create: {
          id: randomBytes(16).toString('hex'),
          module_id: module.id,
          action: permission.action,
          display_name: permission.display_name,
          description: permission.description,
        },
      });
      totalPermissions++;
    }
  }

  console.log(`✅ Seeded ${totalPermissions} permissions`);
}

async function seedRoleTemplates() {
  console.log('👥 Seeding role templates...');

  // Get all permissions for special cases
  const allPermissions = await prisma.permission.findMany({
    include: { module: true },
  });

  for (const template of roleTemplates) {
    // Create or update template
    const roleTemplate = await prisma.role_template.upsert({
      where: { name: template.name },
      update: {
        description: template.description,
        is_system_template: template.is_system_template,
      },
      create: {
        id: randomBytes(16).toString('hex'),
        name: template.name,
        description: template.description,
        is_system_template: template.is_system_template,
      },
    });

    // Determine which permissions this template should have
    let templatePermissionIds: string[] = [];

    if (template.permissions === 'ALL') {
      // Owner gets all permissions
      templatePermissionIds = allPermissions.map(p => p.id);
    } else if (template.permissions === 'ALL_EXCEPT') {
      // Admin gets all except specified modules
      const exceptModules = (template as any).except_modules || [];
      templatePermissionIds = allPermissions
        .filter(p => !exceptModules.includes(p.module.name))
        .map(p => p.id);
    } else if (Array.isArray(template.permissions)) {
      // Specific permissions (e.g., "leads:view", "quotes:create")
      for (const permString of template.permissions) {
        const [moduleName, action] = permString.split(':');
        const permission = allPermissions.find(
          p => p.module.name === moduleName && p.action === action
        );
        if (permission) {
          templatePermissionIds.push(permission.id);
        } else {
          console.warn(`⚠️  Permission not found: ${permString}`);
        }
      }
    }

    // Delete existing template permissions
    await prisma.role_template_permission.deleteMany({
      where: { role_template_id: roleTemplate.id },
    });

    // Create new template permissions
    for (const permissionId of templatePermissionIds) {
      await prisma.role_template_permission.create({
        data: {
          id: randomBytes(16).toString('hex'),
          role_template_id: roleTemplate.id,
          permission_id: permissionId,
        },
      });
    }

    console.log(`  ✓ ${template.name} (${templatePermissionIds.length} permissions)`);
  }

  console.log(`✅ Seeded ${roleTemplates.length} role templates`);
}

async function seedDefaultRoles() {
  console.log('🎭 Seeding default roles...');

  // Create the 7 default roles from templates
  // These are actual roles that can be assigned to users

  for (const template of roleTemplates) {
    const roleTemplate = await prisma.role_template.findUnique({
      where: { name: template.name },
      include: { role_template_permission: true },
    });

    if (!roleTemplate) {
      console.warn(`⚠️  Template "${template.name}" not found, skipping role creation`);
      continue;
    }

    // Create role
    const role = await prisma.role.upsert({
      where: { name: template.name },
      update: {
        description: template.description,
        is_system: true,
        is_active: true,
      },
      create: {
        id: randomBytes(16).toString('hex'),
        updated_at: new Date(),
        name: template.name,
        description: template.description,
        is_system: true,
        is_active: true,
      },
    });

    // Delete existing role permissions
    await prisma.role_permission.deleteMany({
      where: { role_id: role.id },
    });

    // Create role permissions from template
    for (const templatePerm of roleTemplate.role_template_permission) {
      await prisma.role_permission.create({
        data: {
          id: randomBytes(16).toString('hex'),
          role_id: role.id,
          permission_id: templatePerm.permission_id,
        },
      });
    }

    console.log(`  ✓ ${role.name} role created with ${roleTemplate.role_template_permission.length} permissions`);
  }

  console.log(`✅ Seeded ${roleTemplates.length} default roles`);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🌱 Starting RBAC seed...\n');

  try {
    await seedModules();
    await seedPermissions();
    await seedRoleTemplates();
    await seedDefaultRoles();

    console.log('\n✨ RBAC seed completed successfully!\n');
  } catch (error) {
    console.error('❌ Error seeding RBAC data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
