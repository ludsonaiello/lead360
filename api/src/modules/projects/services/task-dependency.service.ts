import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateTaskDependencyDto } from '../dto/create-task-dependency.dto';

export interface BlockingDependency {
  dependency_id: string;
  depends_on_task_id: string;
  depends_on_task_title: string;
  depends_on_task_status: string;
  dependency_type: string;
}

@Injectable()
export class TaskDependencyService {
  private readonly logger = new Logger(TaskDependencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. addDependency — with circular detection + same-project validation
  // ---------------------------------------------------------------------------

  async addDependency(
    tenantId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: CreateTaskDependencyDto,
  ) {
    // Guard: self-reference
    if (taskId === dto.depends_on_task_id) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    // Validate: both tasks exist, belong to the same project and tenant
    const [task, dependsOnTask] = await Promise.all([
      this.prisma.project_task.findFirst({
        where: {
          id: taskId,
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
        select: { id: true, title: true },
      }),
      this.prisma.project_task.findFirst({
        where: {
          id: dto.depends_on_task_id,
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
        select: { id: true, title: true },
      }),
    ]);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!dependsOnTask) {
      throw new NotFoundException(
        'Dependency target task not found in this project',
      );
    }

    // Check for duplicate dependency
    const existing = await this.prisma.task_dependency.findUnique({
      where: {
        task_id_depends_on_task_id: {
          task_id: taskId,
          depends_on_task_id: dto.depends_on_task_id,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'This dependency already exists',
      );
    }

    // Circular dependency detection (DFS)
    const isCircular = await this.detectCircularDependency(
      tenantId,
      projectId,
      taskId,
      dto.depends_on_task_id,
    );

    if (isCircular) {
      throw new ConflictException(
        'Adding this dependency would create a circular dependency chain',
      );
    }

    // Create the dependency record
    const dependency = await this.prisma.task_dependency.create({
      data: {
        tenant_id: tenantId,
        task_id: taskId,
        depends_on_task_id: dto.depends_on_task_id,
        dependency_type: dto.dependency_type,
        created_by_user_id: userId,
      },
      include: {
        depends_on_task: {
          select: { id: true, title: true },
        },
      },
    });

    // Audit log
    this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'task_dependency',
      entityId: dependency.id,
      tenantId,
      actorUserId: userId,
      after: dependency,
      description: `Added dependency: "${task.title}" depends on "${dependsOnTask.title}" (${dto.dependency_type})`,
    });

    return {
      id: dependency.id,
      task_id: dependency.task_id,
      depends_on_task_id: dependency.depends_on_task_id,
      depends_on_task_title: dependency.depends_on_task?.title || null,
      dependency_type: dependency.dependency_type,
      created_at: dependency.created_at,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. removeDependency — delete + audit
  // ---------------------------------------------------------------------------

  async removeDependency(
    tenantId: string,
    projectId: string,
    taskId: string,
    dependencyId: string,
    userId: string,
  ) {
    // Find the dependency with tenant isolation
    const dependency = await this.prisma.task_dependency.findFirst({
      where: {
        id: dependencyId,
        task_id: taskId,
        tenant_id: tenantId,
        task: {
          project_id: projectId,
        },
      },
      include: {
        task: { select: { title: true } },
        depends_on_task: { select: { title: true } },
      },
    });

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.prisma.task_dependency.delete({
      where: { id: dependencyId },
    });

    // Audit log
    this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'task_dependency',
      entityId: dependencyId,
      tenantId,
      actorUserId: userId,
      before: dependency,
      description: `Removed dependency: "${dependency.task.title}" no longer depends on "${dependency.depends_on_task.title}"`,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. getTaskDependencies — both directions
  // ---------------------------------------------------------------------------

  async getTaskDependencies(tenantId: string, taskId: string) {
    // Tasks this task depends on ("I need these done first")
    const dependsOn = await this.prisma.task_dependency.findMany({
      where: {
        task_id: taskId,
        tenant_id: tenantId,
      },
      include: {
        depends_on_task: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Tasks that depend on this task ("These are waiting for me")
    const dependedOnBy = await this.prisma.task_dependency.findMany({
      where: {
        depends_on_task_id: taskId,
        tenant_id: tenantId,
      },
      include: {
        task: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return {
      depends_on: dependsOn.map((d) => ({
        id: d.id,
        depends_on_task_id: d.depends_on_task_id,
        depends_on_task_title: d.depends_on_task?.title || null,
        depends_on_task_status: d.depends_on_task?.status || null,
        dependency_type: d.dependency_type,
        created_at: d.created_at,
      })),
      depended_on_by: dependedOnBy.map((d) => ({
        id: d.id,
        task_id: d.task_id,
        task_title: d.task?.title || null,
        task_status: d.task?.status || null,
        dependency_type: d.dependency_type,
        created_at: d.created_at,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 4. validateStatusTransition — check finish_to_start prerequisites
  // ---------------------------------------------------------------------------

  /**
   * For finish_to_start dependencies: if a task depends on another task,
   * the prerequisite must have status 'done' before the dependent task
   * can move to 'in_progress'.
   *
   * Returns an array of blocking dependencies. Empty array = safe to transition.
   */
  async validateStatusTransition(
    tenantId: string,
    taskId: string,
    newStatus: string,
  ): Promise<BlockingDependency[]> {
    // Only block transitions TO 'in_progress'
    if (newStatus !== 'in_progress') {
      return [];
    }

    // Get all finish_to_start dependencies for this task
    const dependencies = await this.prisma.task_dependency.findMany({
      where: {
        task_id: taskId,
        tenant_id: tenantId,
        dependency_type: 'finish_to_start',
      },
      include: {
        depends_on_task: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    // Find which prerequisite tasks are NOT done
    const blocking: BlockingDependency[] = [];

    for (const dep of dependencies) {
      if (dep.depends_on_task && dep.depends_on_task.status !== 'done') {
        blocking.push({
          dependency_id: dep.id,
          depends_on_task_id: dep.depends_on_task_id,
          depends_on_task_title: dep.depends_on_task.title,
          depends_on_task_status: dep.depends_on_task.status,
          dependency_type: dep.dependency_type,
        });
      }
    }

    return blocking;
  }

  // ---------------------------------------------------------------------------
  // 5. detectCircularDependency — DFS
  // ---------------------------------------------------------------------------

  /**
   * Detects if adding taskId → dependsOnTaskId would create a circular
   * dependency chain within the project.
   *
   * Algorithm:
   * 1. Build adjacency list from all existing dependencies in the project
   * 2. Add the proposed new edge: taskId → dependsOnTaskId
   * 3. DFS from dependsOnTaskId following "depends on" edges
   * 4. If we reach taskId, a cycle would be created → return true
   * 5. If DFS completes without finding taskId → return false
   */
  async detectCircularDependency(
    tenantId: string,
    projectId: string,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<boolean> {
    // Fetch all existing dependencies for tasks in this project
    const dependencies = await this.prisma.task_dependency.findMany({
      where: {
        tenant_id: tenantId,
        task: { project_id: projectId },
      },
      select: {
        task_id: true,
        depends_on_task_id: true,
      },
    });

    // Build adjacency list: task_id → [depends_on_task_id, ...]
    const adjacencyList = new Map<string, string[]>();

    for (const dep of dependencies) {
      if (!adjacencyList.has(dep.task_id)) {
        adjacencyList.set(dep.task_id, []);
      }
      adjacencyList.get(dep.task_id)!.push(dep.depends_on_task_id);
    }

    // Add the proposed new edge
    if (!adjacencyList.has(taskId)) {
      adjacencyList.set(taskId, []);
    }
    adjacencyList.get(taskId)!.push(dependsOnTaskId);

    // DFS from dependsOnTaskId — if we can reach taskId, there's a cycle
    const visited = new Set<string>();
    const stack: string[] = [dependsOnTaskId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (current === taskId) {
        return true; // Circular dependency detected
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const neighbors = adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    return false; // No cycle
  }
}
