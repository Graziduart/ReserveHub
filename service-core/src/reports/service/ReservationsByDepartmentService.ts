import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

export type ReservationsByDepartmentRow = {
  departamento: string;
  total: number;
};

@Injectable()
export class ReservationsByDepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Contagem de reservas por departamento (nome em core.departments). */
  async buildReport(): Promise<ReservationsByDepartmentRow[]> {
    const departments = await this.prisma.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const counts = await this.prisma.reservation.groupBy({
      by: ['userId'],
      _count: { id: true },
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: counts.map((c) => c.userId) } },
      select: { id: true, departmentId: true },
    });
    const deptByUser = new Map(users.map((u) => [u.id, u.departmentId]));

    const totalByDeptId = new Map<string, number>();
    for (const d of departments) {
      totalByDeptId.set(d.id, 0);
    }
    for (const row of counts) {
      const deptId = deptByUser.get(row.userId);
      if (!deptId || !totalByDeptId.has(deptId)) continue;
      totalByDeptId.set(deptId, (totalByDeptId.get(deptId) ?? 0) + row._count.id);
    }

    return departments.map((d) => ({
      departamento: d.name,
      total: totalByDeptId.get(d.id) ?? 0,
    }));
  }
}
