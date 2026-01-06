import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';

// Services
import { RBACService } from './services/rbac.service';
import { RoleService } from './services/role.service';
import { UserRoleService } from './services/user-role.service';
import { PermissionService } from './services/permission.service';
import { ModuleService } from './services/module.service';
import { RoleTemplateService } from './services/role-template.service';

// Controllers
import { UserRolesController } from './controllers/user-roles.controller';
import { AdminController } from './controllers/admin.controller';

// Guards
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permission.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UserRolesController, AdminController],
  providers: [
    // Services
    RBACService,
    RoleService,
    UserRoleService,
    PermissionService,
    ModuleService,
    RoleTemplateService,
    // Guards
    RolesGuard,
    PermissionGuard,
    PlatformAdminGuard,
  ],
  exports: [
    // Export services for use in other modules
    RBACService,
    RoleService,
    UserRoleService,
    // Export guards for use in other modules
    RolesGuard,
    PermissionGuard,
    PlatformAdminGuard,
  ],
})
export class RBACModule {}
