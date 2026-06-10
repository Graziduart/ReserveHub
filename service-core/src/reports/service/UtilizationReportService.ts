import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

export type UtilizationRowDto = {
  recurso: string;
  tipo: string;
  localizacao: string;
  reservasAprovadas: number;
  horasReservadas: number;
  taxaUtilizacao: number;
};

@Injectable()
export class UtilizationReportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildReport(from?: string, to?: string): Promise<UtilizationRowDto[]> {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.APPROVED,
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
        resource: { select: { id: true, name: true, type: true, location: true } },
      },
    });

    const map = new Map<string, UtilizationRowDto>();
    for (const r of reservations) {
      const key = r.resourceId;
      let row = map.get(key);
      if (!row) {
        row = {
          recurso: r.resource.name,
          tipo: r.resource.type,
          localizacao: r.resource.location,
          reservasAprovadas: 0,
          horasReservadas: 0,
          taxaUtilizacao: 0,
        };
        map.set(key, row);
      }
      row.reservasAprovadas += 1;
      const hours =
        (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60);
      row.horasReservadas += hours > 0 ? hours : 0;
    }

    const periodHours =
      fromDate && toDate
        ? Math.max(
            (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60),
            1,
          )
        : 40 * 5;
    for (const row of map.values()) {
      row.taxaUtilizacao = Math.min(
        100,
        Math.round((row.horasReservadas / periodHours) * 100),
      );
    }

    return [...map.values()].sort((a, b) => b.horasReservadas - a.horasReservadas);
  }
}
