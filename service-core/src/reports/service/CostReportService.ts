import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

export type CostReportRowDto = {
  departamento: string;
  sigla: string;
  centroCustoDept: string;
  centroCustoRecurso: string;
  recurso: string;
  reservasAprovadas: number;
  reservasPendentes: number;
  horasReservadas: number;
};

@Injectable()
export class CostReportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildReport(from?: string, to?: string): Promise<CostReportRowDto[]> {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: {
          notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED],
        },
        ...(fromDate || toDate
          ? {
              startDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            department: {
              select: { name: true, sigla: true, costCenterCode: true },
            },
          },
        },
        resource: {
          select: {
            name: true,
            costCenterCode: true,
            department: { select: { name: true, sigla: true, costCenterCode: true } },
          },
        },
      },
    });

    const map = new Map<string, CostReportRowDto>();

    for (const r of reservations) {
      const dept = r.user.department;
      const resDept = r.resource.department;
      const deptName = dept?.name ?? resDept?.name ?? '—';
      const sigla = dept?.sigla ?? resDept?.sigla ?? '—';
      const ccDept = dept?.costCenterCode ?? resDept?.costCenterCode ?? '—';
      const ccRes = r.resource.costCenterCode ?? '—';
      const key = `${deptName}|${r.resourceId}|${ccRes}`;

      let row = map.get(key);
      if (!row) {
        row = {
          departamento: deptName,
          sigla,
          centroCustoDept: ccDept,
          centroCustoRecurso: ccRes,
          recurso: r.resource.name,
          reservasAprovadas: 0,
          reservasPendentes: 0,
          horasReservadas: 0,
        };
        map.set(key, row);
      }

      const hours =
        (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60);
      row.horasReservadas += hours > 0 ? hours : 0;
      if (r.status === ReservationStatus.APPROVED) row.reservasAprovadas += 1;
      if (r.status === ReservationStatus.PENDING) row.reservasPendentes += 1;
    }

    return [...map.values()].sort((a, b) =>
      a.departamento.localeCompare(b.departamento),
    );
  }
}
