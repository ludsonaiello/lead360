import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateEmployeeProjectAssignmentDto,
  ListEmployeeProjectAssignmentsDto,
} from '../dto/employee-project-assignment.dto';

const ASSIGNMENT_INCLUDE = {
  employee_profile: {
    include: {
      user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.employee_project_assignmentInclude;

const DUPLICATE_ASSIGNMENT_MESSAGE =
  'Employee is already assigned to this project';

@Injectable()
export class EmployeeProjectAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async findAll(tenantId: string, query: ListEmployeeProjectAssignmentsDto) {
    const { page = 1, limit = 50, employee_profile_id, project_id } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.employee_project_assignmentWhereInput = {
      tenant_id: tenantId,
    };

    if (employee_profile_id) {
      where.employee_profile_id = employee_profile_id;
    }

    if (project_id) {
      where.project_id = project_id;
    }

    const [data, total] = await Promise.all([
      this.prisma.employee_project_assignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.employee_project_assignment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateEmployeeProjectAssignmentDto,
  ) {
    const employeeProfile = await this.prisma.employee_profile.findFirst({
      where: { id: dto.employee_profile_id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!employeeProfile) {
      throw new NotFoundException('Employee profile not found');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const existing = await this.prisma.employee_project_assignment.findFirst({
      where: {
        tenant_id: tenantId,
        employee_profile_id: dto.employee_profile_id,
        project_id: dto.project_id,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(DUPLICATE_ASSIGNMENT_MESSAGE);
    }

    let assignment;
    try {
      assignment = await this.prisma.employee_project_assignment.create({
        data: {
          tenant_id: tenantId,
          employee_profile_id: dto.employee_profile_id,
          project_id: dto.project_id,
          assigned_by_user_id: userId,
        },
        include: ASSIGNMENT_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(DUPLICATE_ASSIGNMENT_MESSAGE);
      }
      throw error;
    }

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'EmployeeProjectAssignment',
      entityId: assignment.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: assignment.id,
        employee_profile_id: assignment.employee_profile_id,
        project_id: assignment.project_id,
        assigned_by_user_id: assignment.assigned_by_user_id,
        created_at: assignment.created_at,
      },
      description: `Assigned employee ${assignment.employee_profile_id} to project ${assignment.project_id}`,
    });

    return assignment;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const assignment = await this.prisma.employee_project_assignment.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        employee_profile_id: true,
        project_id: true,
        assigned_by_user_id: true,
        created_at: true,
      },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.employee_project_assignment.delete({
      where: { id },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'EmployeeProjectAssignment',
      entityId: assignment.id,
      tenantId,
      actorUserId: userId,
      before: assignment,
      description: `Removed assignment of employee ${assignment.employee_profile_id} from project ${assignment.project_id}`,
    });

    return { message: 'Assignment removed successfully' };
  }
}
