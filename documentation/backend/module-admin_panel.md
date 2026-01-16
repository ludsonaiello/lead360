# Backend Module: Admin Panel

**Module Name**: Platform Admin Dashboard & Management  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/admin-panel-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements comprehensive Platform Admin functionality including dashboard metrics, tenant management with impersonation, system settings (feature flags, maintenance mode), real-time alerts, and data export capabilities.

**Read First**:
- `/documentation/contracts/admin-panel-contract.md` (complete admin panel requirements)
- `/documentation/shared/security-rules.md` (security requirements)
- `/documentation/shared/api-conventions.md` (REST patterns)

---

## Database Tables Structure

### **Tables to Create**

1. **feature_flag** - Feature flag configurations
2. **maintenance_mode** - Maintenance mode settings (single row)
3. **admin_notification** - In-app notifications for Platform Admin
4. **impersonation_session** - Active impersonation sessions
5. **system_setting** - Global system settings (key-value store)
6. **export_job** - Export job tracking

---

## Table Design

### **feature_flag Table**

**Purpose**: Feature flag management (enable/disable features globally)

**Key Fields**:
- id (UUID, primary key)
- flag_key (VARCHAR(100), unique - 'file_storage', 'email_queue', 'user_registration')
- name (VARCHAR(255) - "File Storage")
- description (TEXT - "Allow tenants to upload files")
- is_enabled (BOOLEAN, default true)
- updated_at (TIMESTAMP)
- updated_by_user_id (UUID, foreign key to user)

**Indexes**:
- Primary key on id
- Unique index: (flag_key)

**Seed Data**:
```sql
INSERT INTO feature_flag (flag_key, name, description, is_enabled)
VALUES
  ('file_storage', 'File Storage', 'Allow tenants to upload files', true),
  ('email_queue', 'Email Queue', 'Allow system to send emails', true),
  ('background_jobs', 'Background Jobs', 'Allow job scheduling', true),
  ('user_registration', 'User Registration', 'Allow new tenant signups', true),
  ('api_access', 'API Access', 'Allow API requests', true);
```

**Business Rules**:
- If feature disabled, block access globally (middleware check)
- Audit log all flag changes

---

### **maintenance_mode Table**

**Purpose**: Maintenance mode configuration (single row)

**Key Fields**:
- id (UUID, primary key)
- is_enabled (BOOLEAN, default false)
- mode (ENUM: immediate, scheduled)
- start_time (TIMESTAMP, nullable)
- end_time (TIMESTAMP, nullable)
- message (TEXT - custom message shown to users)
- allowed_ips (TEXT, nullable - comma-separated list)
- updated_at (TIMESTAMP)
- updated_by_user_id (UUID, foreign key to user)

**Seed Data**:
```sql
INSERT INTO maintenance_mode (is_enabled, mode, message)
VALUES (false, 'immediate', 'Lead360 is undergoing maintenance. We''ll be back shortly.');
```

**Business Rules**:
- Only one row exists (singleton)
- When enabled, show maintenance page to all users except allowed IPs
- If scheduled and current time < start_time, don't show maintenance page yet
- If scheduled and current time > end_time, auto-disable maintenance mode

---

### **admin_notification Table**

**Purpose**: In-app notifications for Platform Admin

**Key Fields**:
- id (UUID, primary key)
- type (ENUM: new_tenant, storage_limit, job_spike, system_down, suspicious_activity)
- title (VARCHAR(255))
- message (TEXT)
- link (TEXT, nullable - URL to relevant page)
- is_read (BOOLEAN, default false)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP, nullable - auto-delete after expiry)

**Indexes**:
- Primary key on id
- Index: (is_read, created_at DESC) - unread first

**Business Rules**:
- Delete notifications older than 30 days (background job)
- Max 1000 notifications (delete oldest when limit reached)

---

### **impersonation_session Table**

**Purpose**: Track active impersonation sessions

**Key Fields**:
- id (UUID, primary key)
- admin_user_id (UUID, foreign key to user - Platform Admin)
- impersonated_user_id (UUID, foreign key to user)
- impersonated_tenant_id (UUID, foreign key to tenant)
- session_token (VARCHAR(255), unique - JWT or UUID)
- expires_at (TIMESTAMP - 1 hour from creation)
- created_at (TIMESTAMP)

**Indexes**:
- Primary key on id
- Unique index: (session_token)
- Index: (admin_user_id) - find all sessions by admin
- Index: (expires_at) - cleanup expired sessions

**Business Rules**:
- Session expires after 1 hour
- Only one active impersonation per admin at a time (end previous if starting new)
- Audit log all actions during impersonation

---

### **system_setting Table**

**Purpose**: Global system settings (key-value store)

**Key Fields**:
- id (UUID, primary key)
- setting_key (VARCHAR(100), unique)
- setting_value (TEXT)
- data_type (ENUM: string, integer, boolean, json)
- description (TEXT)
- updated_at (TIMESTAMP)
- updated_by_user_id (UUID, foreign key to user)

**Indexes**:
- Primary key on id
- Unique index: (setting_key)

**Seed Data**:
```sql
INSERT INTO system_setting (setting_key, setting_value, data_type, description)
VALUES
  ('max_file_upload_size_mb', '10', 'integer', 'Max file upload size in MB'),
  ('max_storage_per_tenant_gb', '500', 'integer', 'Max storage per tenant in GB'),
  ('session_timeout_minutes', '30', 'integer', 'Session timeout in minutes'),
  ('password_reset_token_expiry_hours', '24', 'integer', 'Password reset token expiry'),
  ('max_failed_login_attempts', '5', 'integer', 'Max failed login attempts before lockout'),
  ('account_lockout_duration_minutes', '15', 'integer', 'Account lockout duration'),
  ('job_retention_days', '30', 'integer', 'Job record retention in days'),
  ('audit_log_retention_days', '90', 'integer', 'Audit log retention in days');
```

---

### **export_job Table**

**Purpose**: Track export job status

**Key Fields**:
- id (UUID, primary key)
- admin_user_id (UUID, foreign key to user)
- export_type (ENUM: tenants, users, audit_logs)
- format (ENUM: csv, pdf)
- filters (JSONB - filter parameters)
- status (ENUM: pending, processing, completed, failed)
- file_path (TEXT, nullable - path to generated file)
- row_count (INTEGER, nullable)
- error_message (TEXT, nullable)
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP, nullable)

**Indexes**:
- Primary key on id
- Index: (admin_user_id, created_at DESC) - export history
- Index: (status) - find pending exports

**Business Rules**:
- Delete completed exports older than 7 days (background job)
- Max 10 pending exports per admin (prevent abuse)

---

## NestJS Module Structure

**Directory**:
```
src/modules/admin/
├── admin.module.ts
├── controllers/
│   ├── dashboard.controller.ts
│   ├── tenant-management.controller.ts
│   ├── user-management.controller.ts
│   ├── system-settings.controller.ts
│   ├── alerts.controller.ts
│   └── exports.controller.ts
├── services/
│   ├── dashboard.service.ts
│   ├── tenant-management.service.ts
│   ├── impersonation.service.ts
│   ├── feature-flag.service.ts
│   ├── maintenance-mode.service.ts
│   ├── alert.service.ts
│   ├── system-setting.service.ts
│   └── export.service.ts
├── jobs/
│   ├── daily-stats-email.job.ts
│   ├── notification-cleanup.job.ts
│   └── export-processor.job.ts
├── middleware/
│   ├── platform-admin.middleware.ts
│   ├── feature-flag.middleware.ts
│   └── maintenance-mode.middleware.ts
├── dto/
│   ├── dashboard-metrics.dto.ts
│   ├── create-tenant.dto.ts
│   ├── impersonate-user.dto.ts
│   ├── update-feature-flag.dto.ts
│   └── export-request.dto.ts
└── admin.service.spec.ts
```

---

## Core Service Methods

### **DashboardService**

**Location**: `services/dashboard.service.ts`

**Methods**:

1. **getMetrics()**
   ```typescript
   async getMetrics() {
     const [
       activeTenants,
       tenantsGrowth,
       totalUsers,
       usersGrowth,
       jobSuccessRate,
       storageUsed,
       systemHealth,
     ] = await Promise.all([
       this.getActiveTenants(),
       this.getTenantsGrowth(),
       this.getTotalUsers(),
       this.getUsersGrowth(),
       this.getJobSuccessRate(),
       this.getStorageUsed(),
       this.getSystemHealth(),
     ]);

     return {
       activeTenants: {
         count: activeTenants,
         growth: tenantsGrowth,
         sparkline: await this.getTenantSparkline(),
       },
       totalUsers: {
         count: totalUsers,
         growth: usersGrowth,
         sparkline: await this.getUserSparkline(),
       },
       jobSuccessRate: {
         percentage: jobSuccessRate,
         totalJobs: await this.getTotalJobs24h(),
         failedJobs: await this.getFailedJobs24h(),
         status: jobSuccessRate > 95 ? 'healthy' : jobSuccessRate > 90 ? 'warning' : 'critical',
       },
       storageUsed: {
         current: storageUsed.current,
         limit: storageUsed.limit,
         percentage: (storageUsed.current / storageUsed.limit) * 100,
       },
       systemHealth,
     };
   }
   ```

2. **getActiveTenants()**
   ```typescript
   async getActiveTenants() {
     return await tenantRepository.count({
       where: { status: 'active' },
     });
   }
   ```

3. **getTenantsGrowth()**
   ```typescript
   async getTenantsGrowth() {
     const startOfMonth = startOfMonth(new Date());
     const newThisMonth = await tenantRepository.count({
       where: {
         created_at: MoreThanOrEqual(startOfMonth),
       },
     });

     const lastMonth = await tenantRepository.count({
       where: {
         created_at: Between(subMonths(startOfMonth, 1), startOfMonth),
       },
     });

     const percentageChange = lastMonth > 0 ? ((newThisMonth - lastMonth) / lastMonth) * 100 : 100;

     return {
       count: newThisMonth,
       percentage: percentageChange,
       trend: percentageChange > 0 ? 'up' : 'down',
     };
   }
   ```

4. **getChartData(chartType, params)**
   - tenant-growth: Returns last 90 days of tenant creation
   - user-signups: Returns last 90 days of user creation
   - job-trends: Returns last 7 days of job success/failure
   - tenants-by-industry: Returns distribution
   - tenants-by-size: Returns distribution
   - users-by-role: Returns distribution

5. **getRecentActivity(limit = 10)**
   ```typescript
   async getRecentActivity(limit = 10) {
     return await auditLogRepository.find({
       where: {
         action_type: In(['created', 'deleted', 'failed']),
         entity_type: In(['tenant', 'user', 'job']),
       },
       order: { created_at: 'DESC' },
       take: limit,
     });
   }
   ```

---

### **TenantManagementService**

**Location**: `services/tenant-management.service.ts`

**Methods**:

1. **createTenantManually(createDto, adminUserId)**
   ```typescript
   async createTenantManually(createDto, adminUserId) {
     // Validate subdomain uniqueness
     const existingTenant = await tenantRepository.findOne({
       where: { subdomain: createDto.subdomain },
     });
     if (existingTenant) {
       throw new ConflictException('Subdomain already exists');
     }

     // Create tenant
     const tenant = await tenantRepository.save({
       business_name: createDto.business_name,
       subdomain: createDto.subdomain,
       industry: createDto.industry,
       status: 'active',
     });

     // Create owner user
     const ownerUser = await userRepository.save({
       tenant_id: tenant.id,
       email: createDto.owner_email,
       first_name: createDto.owner_first_name,
       last_name: createDto.owner_last_name,
       password: await bcrypt.hash(createDto.owner_password, 10),
       role: 'owner',
       email_verified: createDto.skip_email_verification,
     });

     // Send welcome email (if enabled)
     if (createDto.send_welcome_email && !createDto.skip_email_verification) {
       await emailService.send({
         to: ownerUser.email,
         template: 'welcome-email',
         variables: {
           name: ownerUser.first_name,
           subdomain: tenant.subdomain,
           login_link: `https://${tenant.subdomain}.lead360.com`,
         },
       });
     }

     // Audit log
     await auditLogger.log({
       action_type: 'created',
       entity_type: 'tenant',
       entity_id: tenant.id,
       actor_user_id: adminUserId,
       description: `Tenant manually created by Platform Admin`,
       after_json: { tenant, owner: ownerUser },
     });

     return { tenant, owner: ownerUser };
   }
   ```

2. **suspendTenant(tenantId, adminUserId, reason?)**
   ```typescript
   async suspendTenant(tenantId, adminUserId, reason?) {
     const tenant = await tenantRepository.findOne({ where: { id: tenantId } });
     if (!tenant) throw new NotFoundException('Tenant not found');

     tenant.status = 'suspended';
     tenant.suspended_at = new Date();
     tenant.suspended_reason = reason;
     await tenantRepository.save(tenant);

     // Invalidate all active sessions for this tenant
     await sessionRepository.delete({ tenant_id: tenantId });

     // Audit log
     await auditLogger.log({
       action_type: 'updated',
       entity_type: 'tenant',
       entity_id: tenantId,
       actor_user_id: adminUserId,
       description: `Tenant suspended: ${reason || 'No reason provided'}`,
       before_json: { status: 'active' },
       after_json: { status: 'suspended', reason },
     });

     // Send alert notification
     await alertService.createNotification({
       type: 'tenant_suspended',
       title: 'Tenant Suspended',
       message: `${tenant.business_name} has been suspended`,
       link: `/admin/tenants/${tenantId}`,
     });

     return tenant;
   }
   ```

3. **activateTenant(tenantId, adminUserId)**
4. **deleteTenant(tenantId, adminUserId)** - Soft delete with 90-day retention
5. **getTenantDetails(tenantId)** - Full tenant info with users, stats

---

### **ImpersonationService**

**Location**: `services/impersonation.service.ts`

**Methods**:

1. **startImpersonation(adminUserId, impersonatedUserId)**
   ```typescript
   async startImpersonation(adminUserId, impersonatedUserId) {
     // Validate admin is Platform Admin
     const admin = await userRepository.findOne({ where: { id: adminUserId } });
     if (admin.role !== 'platform_admin') {
       throw new ForbiddenException('Only Platform Admin can impersonate');
     }

     // Validate impersonated user exists
     const impersonatedUser = await userRepository.findOne({
       where: { id: impersonatedUserId },
       relations: ['tenant'],
     });
     if (!impersonatedUser) {
       throw new NotFoundException('User not found');
     }

     // End any existing impersonation session for this admin
     await impersonationSessionRepository.delete({
       admin_user_id: adminUserId,
     });

     // Create impersonation session
     const sessionToken = uuidv4();
     const expiresAt = addHours(new Date(), 1); // 1 hour expiry

     const session = await impersonationSessionRepository.save({
       admin_user_id: adminUserId,
       impersonated_user_id: impersonatedUserId,
       impersonated_tenant_id: impersonatedUser.tenant_id,
       session_token: sessionToken,
       expires_at: expiresAt,
     });

     // Audit log
     await auditLogger.log({
       action_type: 'created',
       entity_type: 'impersonation_session',
       entity_id: session.id,
       actor_user_id: adminUserId,
       description: `Started impersonating ${impersonatedUser.first_name} ${impersonatedUser.last_name} (${impersonatedUser.email})`,
       metadata_json: {
         impersonated_user_id: impersonatedUserId,
         impersonated_tenant_id: impersonatedUser.tenant_id,
       },
     });

     return {
       session_token: sessionToken,
       impersonated_user: impersonatedUser,
       expires_at: expiresAt,
     };
   }
   ```

2. **validateImpersonationSession(sessionToken)**
   ```typescript
   async validateImpersonationSession(sessionToken) {
     const session = await impersonationSessionRepository.findOne({
       where: { session_token: sessionToken },
       relations: ['admin_user', 'impersonated_user'],
     });

     if (!session) {
       throw new UnauthorizedException('Invalid impersonation session');
     }

     if (new Date() > session.expires_at) {
       await this.endImpersonation(sessionToken);
       throw new UnauthorizedException('Impersonation session expired');
     }

     return session;
   }
   ```

3. **endImpersonation(sessionToken)**
   ```typescript
   async endImpersonation(sessionToken) {
     const session = await impersonationSessionRepository.findOne({
       where: { session_token: sessionToken },
     });

     if (!session) {
       throw new NotFoundException('Impersonation session not found');
     }

     // Audit log
     await auditLogger.log({
       action_type: 'deleted',
       entity_type: 'impersonation_session',
       entity_id: session.id,
       actor_user_id: session.admin_user_id,
       description: 'Ended impersonation session',
     });

     // Delete session
     await impersonationSessionRepository.delete({ id: session.id });

     return { message: 'Impersonation session ended' };
   }
   ```

**Impersonation Middleware**:
```typescript
// Add to all protected routes
@Injectable()
export class ImpersonationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const impersonationToken = req.headers['x-impersonation-token'];
    
    if (impersonationToken) {
      const session = await impersonationService.validateImpersonationSession(impersonationToken);
      req.user = session.impersonated_user; // Override current user
      req.impersonating_admin = session.admin_user;
      req.is_impersonating = true;
    }
    
    next();
  }
}
```

---

### **FeatureFlagService**

**Location**: `services/feature-flag.service.ts`

**Methods**:

1. **isEnabled(flagKey): boolean**
   ```typescript
   async isEnabled(flagKey: string): Promise<boolean> {
     const flag = await featureFlagRepository.findOne({
       where: { flag_key: flagKey },
     });
     return flag?.is_enabled ?? false;
   }
   ```

2. **toggleFlag(flagKey, adminUserId)**
   ```typescript
   async toggleFlag(flagKey, adminUserId) {
     const flag = await featureFlagRepository.findOne({
       where: { flag_key: flagKey },
     });

     if (!flag) {
       throw new NotFoundException('Feature flag not found');
     }

     flag.is_enabled = !flag.is_enabled;
     flag.updated_by_user_id = adminUserId;
     await featureFlagRepository.save(flag);

     // Audit log
     await auditLogger.log({
       action_type: 'updated',
       entity_type: 'feature_flag',
       entity_id: flag.id,
       actor_user_id: adminUserId,
       description: `Feature flag ${flag.name} ${flag.is_enabled ? 'enabled' : 'disabled'}`,
     });

     return flag;
   }
   ```

**Feature Flag Middleware**:
```typescript
@Injectable()
export class FeatureFlagMiddleware implements NestMiddleware {
  constructor(private featureFlagService: FeatureFlagService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Check feature flags for specific routes
    if (req.path.startsWith('/files')) {
      const fileStorageEnabled = await this.featureFlagService.isEnabled('file_storage');
      if (!fileStorageEnabled) {
        throw new ServiceUnavailableException('File storage is currently disabled');
      }
    }

    next();
  }
}
```

---

### **MaintenanceModeService**

**Location**: `services/maintenance-mode.service.ts`

**Methods**:

1. **isInMaintenanceMode(): boolean**
   ```typescript
   async isInMaintenanceMode(): Promise<boolean> {
     const config = await maintenanceModeRepository.findOne();
     
     if (!config || !config.is_enabled) return false;

     // If immediate mode, always in maintenance
     if (config.mode === 'immediate') return true;

     // If scheduled, check if current time is within window
     const now = new Date();
     if (config.mode === 'scheduled') {
       if (config.start_time && config.end_time) {
         // Check if we're in maintenance window
         if (now >= config.start_time && now <= config.end_time) {
           return true;
         }

         // If past end time, auto-disable maintenance mode
         if (now > config.end_time) {
           await this.disableMaintenanceMode();
           return false;
         }
       }
     }

     return false;
   }
   ```

2. **updateMaintenanceMode(updateDto, adminUserId)**
   ```typescript
   async updateMaintenanceMode(updateDto, adminUserId) {
     let config = await maintenanceModeRepository.findOne();

     if (!config) {
       config = maintenanceModeRepository.create();
     }

     Object.assign(config, updateDto);
     config.updated_by_user_id = adminUserId;
     await maintenanceModeRepository.save(config);

     // Audit log
     await auditLogger.log({
       action_type: 'updated',
       entity_type: 'maintenance_mode',
       actor_user_id: adminUserId,
       description: `Maintenance mode ${config.is_enabled ? 'enabled' : 'disabled'}`,
       after_json: config,
     });

     return config;
   }
   ```

**Maintenance Mode Middleware**:
```typescript
@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  constructor(private maintenanceModeService: MaintenanceModeService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip check for admin routes
    if (req.path.startsWith('/admin')) {
      return next();
    }

    // Check if in maintenance mode
    const isInMaintenance = await this.maintenanceModeService.isInMaintenanceMode();
    
    if (isInMaintenance) {
      // Check if IP is whitelisted
      const config = await maintenanceModeRepository.findOne();
      const allowedIPs = config.allowed_ips?.split(',').map(ip => ip.trim()) || [];
      
      if (!allowedIPs.includes(req.ip)) {
        return res.status(503).json({
          statusCode: 503,
          message: config.message,
          maintenance: true,
          estimatedEnd: config.end_time,
        });
      }
    }

    next();
  }
}
```

---

### **AlertService**

**Location**: `services/alert.service.ts`

**Methods**:

1. **createNotification(notificationDto)**
   ```typescript
   async createNotification(notificationDto) {
     const notification = await adminNotificationRepository.save({
       type: notificationDto.type,
       title: notificationDto.title,
       message: notificationDto.message,
       link: notificationDto.link,
       expires_at: addDays(new Date(), 30), // 30-day expiry
     });

     // Send email alert (if critical)
     if (['system_down', 'suspicious_activity'].includes(notificationDto.type)) {
       await this.sendEmailAlert(notificationDto);
     }

     return notification;
   }
   ```

2. **sendEmailAlert(alert)**
   ```typescript
   async sendEmailAlert(alert) {
     const platformAdmins = await userRepository.find({
       where: { role: 'platform_admin' },
     });

     for (const admin of platformAdmins) {
       await emailService.send({
         to: admin.email,
         template: 'admin-alert',
         variables: {
           title: alert.title,
           message: alert.message,
           link: `https://lead360.com${alert.link}`,
           severity: this.getSeverity(alert.type),
         },
       });
     }
   }
   ```

3. **sendDailyStatsEmail()** - Background job, runs daily at 8am
   ```typescript
   async sendDailyStatsEmail() {
     const metrics = await dashboardService.getMetrics();
     
     const yesterday = subDays(new Date(), 1);
     const newTenants = await tenantRepository.count({
       where: { created_at: MoreThanOrEqual(yesterday) },
     });
     const newUsers = await userRepository.count({
       where: { created_at: MoreThanOrEqual(yesterday) },
     });

     const platformAdmins = await userRepository.find({
       where: { role: 'platform_admin' },
     });

     for (const admin of platformAdmins) {
       await emailService.send({
         to: admin.email,
         template: 'daily-stats-email',
         variables: {
           date: format(new Date(), 'MMMM d, yyyy'),
           activeTenants: metrics.activeTenants.count,
           tenantsGrowth: metrics.activeTenants.growth,
           totalUsers: metrics.totalUsers.count,
           usersGrowth: metrics.totalUsers.growth,
           newTenants,
           newUsers,
           jobSuccessRate: metrics.jobSuccessRate.percentage,
           totalJobs: metrics.jobSuccessRate.totalJobs,
           failedJobs: metrics.jobSuccessRate.failedJobs,
           storageUsed: metrics.storageUsed.current,
           storageLimit: metrics.storageUsed.limit,
           alerts: await this.getAlertsSummary(),
           dashboardLink: 'https://lead360.com/admin/dashboard',
         },
       });
     }
   }
   ```

---

### **ExportService**

**Location**: `services/export.service.ts`

**Methods**:

1. **exportTenants(filters, format, adminUserId)**
   ```typescript
   async exportTenants(filters, format, adminUserId) {
     // Create export job
     const exportJob = await exportJobRepository.save({
       admin_user_id: adminUserId,
       export_type: 'tenants',
       format,
       filters,
       status: 'pending',
     });

     // Queue background job
     await jobQueue.add('export-processor', {
       export_job_id: exportJob.id,
     });

     return { job_id: exportJob.id, status: 'processing' };
   }
   ```

2. **processExportJob(exportJobId)** - Background job processor
   ```typescript
   async processExportJob(exportJobId) {
     const exportJob = await exportJobRepository.findOne({
       where: { id: exportJobId },
     });

     try {
       exportJob.status = 'processing';
       await exportJobRepository.save(exportJob);

       // Fetch data with filters
       const data = await this.fetchDataForExport(exportJob.export_type, exportJob.filters);

       // Generate file (CSV or PDF)
       const filePath = await this.generateExportFile(data, exportJob.format, exportJob.export_type);

       // Update job
       exportJob.status = 'completed';
       exportJob.file_path = filePath;
       exportJob.row_count = data.length;
       exportJob.completed_at = new Date();
       await exportJobRepository.save(exportJob);

       // Audit log
       await auditLogger.log({
         action_type: 'created',
         entity_type: 'export',
         entity_id: exportJob.id,
         actor_user_id: exportJob.admin_user_id,
         description: `Exported ${exportJob.row_count} ${exportJob.export_type} as ${exportJob.format.toUpperCase()}`,
       });

     } catch (error) {
       exportJob.status = 'failed';
       exportJob.error_message = error.message;
       await exportJobRepository.save(exportJob);
     }
   }
   ```

3. **generateExportFile(data, format, exportType)**
   ```typescript
   async generateExportFile(data, format, exportType) {
     const fileName = `${exportType}_${Date.now()}.${format}`;
     const filePath = `exports/${fileName}`;

     if (format === 'csv') {
       const csv = this.convertToCSV(data);
       await fs.writeFile(filePath, csv);
     } else if (format === 'pdf') {
       const pdf = await this.generatePDF(data, exportType);
       await fs.writeFile(filePath, pdf);
     }

     return filePath;
   }
   ```

---

## API Controllers

### **DashboardController**

**Location**: `controllers/dashboard.controller.ts`

**Routes**:

1. **GET /admin/dashboard/metrics**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Returns all 6 dashboard metrics

2. **GET /admin/dashboard/charts/:chartType**
   - Chart types: tenant-growth, user-signups, job-trends, tenants-by-industry, tenants-by-size, users-by-role

3. **GET /admin/dashboard/activity**
   - Returns recent activity feed (last 10 actions)

---

### **TenantManagementController**

**Location**: `controllers/tenant-management.controller.ts`

**Routes**:

1. **GET /admin/tenants** - List tenants (with filters, pagination)
2. **GET /admin/tenants/:id** - Get tenant details
3. **POST /admin/tenants** - Create tenant manually
4. **PATCH /admin/tenants/:id** - Update tenant
5. **PATCH /admin/tenants/:id/suspend** - Suspend tenant
6. **PATCH /admin/tenants/:id/activate** - Activate tenant
7. **DELETE /admin/tenants/:id** - Delete tenant
8. **POST /admin/tenants/:id/impersonate** - Start impersonation
9. **POST /admin/impersonation/exit** - Exit impersonation

---

### **UserManagementController**

**Location**: `controllers/user-management.controller.ts`

**Routes**:

1. **GET /admin/users** - List all users (with filters, pagination)
2. **GET /admin/users/:id** - Get user details
3. **POST /admin/users/:id/reset-password** - Force password reset
4. **POST /admin/users/:id/deactivate** - Deactivate user
5. **POST /admin/users/:id/activate** - Activate user
6. **DELETE /admin/users/:id** - Delete user

---

### **SystemSettingsController**

**Location**: `controllers/system-settings.controller.ts`

**Routes**:

1. **GET /admin/settings/feature-flags** - Get all feature flags
2. **PATCH /admin/settings/feature-flags/:key** - Toggle feature flag
3. **GET /admin/settings/maintenance** - Get maintenance mode config
4. **PATCH /admin/settings/maintenance** - Update maintenance mode
5. **GET /admin/settings/global** - Get all global settings
6. **PATCH /admin/settings/global** - Update global settings

---

### **AlertsController**

**Location**: `controllers/alerts.controller.ts`

**Routes**:

1. **GET /admin/alerts** - Get in-app notifications
2. **PATCH /admin/alerts/:id/read** - Mark notification as read
3. **POST /admin/alerts/mark-all-read** - Mark all as read
4. **DELETE /admin/alerts/:id** - Delete notification

---

### **ExportsController**

**Location**: `controllers/exports.controller.ts`

**Routes**:

1. **POST /admin/exports/tenants** - Export tenants (CSV/PDF)
2. **POST /admin/exports/users** - Export users (CSV/PDF)
3. **POST /admin/exports/audit-logs** - Export audit logs (CSV/PDF)
4. **GET /admin/exports/history** - Get export history
5. **GET /admin/exports/:id/download** - Download completed export

---

## Background Jobs

### **DailyStatsEmailJob**

**Trigger**: Cron (daily at 8:00 AM)

**Process**:
- Fetch dashboard metrics
- Calculate yesterday's changes
- Send email to all Platform Admins
- Template: daily-stats-email

---

### **NotificationCleanupJob**

**Trigger**: Cron (daily at 2:00 AM)

**Process**:
- Delete notifications older than 30 days
- Keep max 1000 notifications (delete oldest)

---

### **ExportProcessorJob**

**Trigger**: Queued by ExportService

**Process**:
- Fetch data with filters
- Generate CSV or PDF
- Store file
- Update export job status

---

## Audit Logging

**Log These Actions**:
- Tenant created manually → action_type: created, entity_type: tenant
- Tenant suspended → action_type: updated, entity_type: tenant
- Tenant deleted → action_type: deleted, entity_type: tenant
- Impersonation started → action_type: created, entity_type: impersonation_session
- Impersonation ended → action_type: deleted, entity_type: impersonation_session
- Feature flag toggled → action_type: updated, entity_type: feature_flag
- Maintenance mode updated → action_type: updated, entity_type: maintenance_mode
- User force password reset → action_type: updated, entity_type: user
- Export generated → action_type: created, entity_type: export

---

## Testing Requirements

### **Unit Tests** (>80% coverage)

1. **DashboardService**
   - ✅ Calculate all 6 metrics correctly
   - ✅ Generate chart data
   - ✅ Recent activity feed

2. **TenantManagementService**
   - ✅ Create tenant manually
   - ✅ Suspend tenant
   - ✅ Activate tenant
   - ✅ Delete tenant

3. **ImpersonationService**
   - ✅ Start impersonation
   - ✅ Validate session
   - ✅ End impersonation
   - ✅ Session expiry

4. **FeatureFlagService**
   - ✅ Check flag enabled
   - ✅ Toggle flag

5. **MaintenanceModeService**
   - ✅ Check maintenance mode
   - ✅ Scheduled maintenance
   - ✅ IP whitelist

6. **AlertService**
   - ✅ Create notification
   - ✅ Send email alert
   - ✅ Daily stats email

7. **ExportService**
   - ✅ Export tenants (CSV)
   - ✅ Export users (PDF)
   - ✅ Apply filters

---

### **Integration Tests**

1. **Dashboard Metrics**
   - ✅ All metrics return correct values
   - ✅ Growth calculations accurate

2. **Tenant Management**
   - ✅ Create tenant → Owner created → Email sent
   - ✅ Suspend tenant → Sessions invalidated
   - ✅ Activate tenant → Can login again

3. **Impersonation**
   - ✅ Start impersonation → View as tenant
   - ✅ Actions logged with impersonation note
   - ✅ Exit impersonation → Back to admin

4. **Feature Flags**
   - ✅ Flag disabled → Feature blocked
   - ✅ Middleware checks flag

5. **Maintenance Mode**
   - ✅ Enabled → Users see maintenance page
   - ✅ IP whitelisted → Can access
   - ✅ Scheduled → Only active during window

6. **Alerts**
   - ✅ New tenant signup → Notification created + email sent
   - ✅ Daily stats email sent at 8am

7. **Exports**
   - ✅ Export tenants → CSV generated correctly
   - ✅ Filters applied correctly

---

## Completion Checklist

- [ ] All tables created (feature_flag, maintenance_mode, admin_notification, impersonation_session, system_setting, export_job)
- [ ] DashboardService (all metrics, charts, activity)
- [ ] TenantManagementService (CRUD, suspend, activate, delete)
- [ ] ImpersonationService (start, validate, end)
- [ ] FeatureFlagService (check, toggle)
- [ ] MaintenanceModeService (check, update)
- [ ] AlertService (notifications, email, daily stats)
- [ ] ExportService (CSV, PDF generation)
- [ ] All controllers (6 controllers, 35 endpoints)
- [ ] All middleware (PlatformAdmin, FeatureFlag, MaintenanceMode, Impersonation)
- [ ] Background jobs (DailyStatsEmail, NotificationCleanup, ExportProcessor)
- [ ] Audit logging (all admin actions)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete (Swagger)

---

## Common Pitfalls to Avoid

1. **Don't skip impersonation audit logging** - Security critical
2. **Don't forget session expiry** - Impersonation sessions must timeout
3. **Don't skip IP whitelist check** - Maintenance mode bypass
4. **Don't forget to invalidate sessions** - When suspending tenant
5. **Don't skip email alerts** - Critical events need immediate notification
6. **Don't forget CSV escaping** - Export data may contain commas
7. **Don't skip feature flag middleware** - Must actually block features
8. **Don't forget scheduled maintenance** - Auto-disable after end time

---

**End of Backend Module Documentation**

Admin panel backend is the most complex module in Sprint 0. Take your time, test thoroughly, and ensure security is bulletproof.