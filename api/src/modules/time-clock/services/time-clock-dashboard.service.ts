import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface UserSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface TaskSummary {
  id: string;
  title: string;
}

export interface AddressSummary {
  label: string;
}

export interface CurrentBreakSummary {
  id: string;
  break_type: string;
  break_label: string | null;
  started_at: Date;
}

export interface DashboardEmployee {
  employee_profile_id: string;
  user: UserSummary;
  session: {
    id: string;
    status: string;
    clock_in_at: Date;
    elapsed_minutes: number;
    project: ProjectSummary | null;
    task: TaskSummary | null;
    clockin_address: AddressSummary | null;
    is_flagged: boolean;
    current_break: CurrentBreakSummary | null;
  };
}

export interface DashboardResponse {
  total_clocked_in: number;
  total_on_break: number;
  employees: DashboardEmployee[];
}

@Injectable()
export class TimeClockDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getWhosIn(tenantId: string): Promise<DashboardResponse> {
    const sessions = await this.prisma.clock_session.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'on_break'] },
      },
      orderBy: { clock_in_at: 'asc' },
      include: {
        employee_profile: {
          include: {
            user: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        clockin_address: { select: { label: true } },
        break_entries: {
          where: { ended_at: null },
          orderBy: { started_at: 'desc' },
          take: 1,
        },
      },
    });

    const now = Date.now();
    let totalClockedIn = 0;
    let totalOnBreak = 0;

    const employees: DashboardEmployee[] = sessions.map((session) => {
      if (session.status === 'active') {
        totalClockedIn += 1;
      } else if (session.status === 'on_break') {
        totalOnBreak += 1;
      }

      const elapsedMinutes = Math.max(
        0,
        Math.floor((now - new Date(session.clock_in_at).getTime()) / 60000),
      );

      const activeBreak = session.break_entries[0];
      const currentBreak: CurrentBreakSummary | null = activeBreak
        ? {
            id: activeBreak.id,
            break_type: activeBreak.break_type,
            break_label: activeBreak.break_label,
            started_at: activeBreak.started_at,
          }
        : null;

      return {
        employee_profile_id: session.employee_profile_id,
        user: {
          id: session.employee_profile.user.id,
          first_name: session.employee_profile.user.first_name,
          last_name: session.employee_profile.user.last_name,
        },
        session: {
          id: session.id,
          status: session.status,
          clock_in_at: session.clock_in_at,
          elapsed_minutes: elapsedMinutes,
          project: session.project
            ? { id: session.project.id, name: session.project.name }
            : null,
          task: session.task
            ? { id: session.task.id, title: session.task.title }
            : null,
          clockin_address: session.clockin_address
            ? { label: session.clockin_address.label }
            : null,
          is_flagged: session.is_flagged,
          current_break: currentBreak,
        },
      };
    });

    return {
      total_clocked_in: totalClockedIn,
      total_on_break: totalOnBreak,
      employees,
    };
  }
}
