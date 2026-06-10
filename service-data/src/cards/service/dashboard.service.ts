import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DashboardSummary } from '../schemas/dashboard.schema';

const KEY = 'default';

export type DomainEnvelope = {
  eventId: string;
  occurredAt: string;
  routingKey: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(DashboardSummary.name)
    private readonly model: Model<DashboardSummary>,
  ) {}

  async getDashboard() {
    const doc = await this.model.findOne({ key: KEY }).lean().exec();
    if (!doc) {
      return {
        key: KEY,
        departmentsActive: 0,
        resourcesActive: 0,
        reservationsByStatus: {},
        updatedAt: null,
      };
    }
    return doc;
  }

  async applyEnvelope(env: DomainEnvelope) {
    const rk = env.routingKey;
    const p = env.payload;

    switch (rk) {
      case 'core.department.created': {
        const d = p.department as { active?: boolean } | undefined;
        if (d?.active !== false) {
          await this.bumpDepartments(1);
        }
        break;
      }
      case 'core.department.disabled':
        await this.bumpDepartments(-1);
        break;

      case 'core.department.updated': {
        const prev = p.previousActive as boolean | undefined;
        const d = p.department as { active?: boolean } | undefined;
        if (prev !== undefined && d?.active !== undefined && prev !== d.active) {
          await this.bumpDepartments(d.active ? 1 : -1);
        }
        break;
      }

      case 'core.resource.created': {
        const r = p.resource as { active?: boolean } | undefined;
        if (r?.active !== false) {
          await this.bumpResources(1);
        }
        break;
      }
      case 'core.resource.disabled':
        await this.bumpResources(-1);
        break;

      case 'core.resource.updated': {
        const prev = p.previousActive as boolean | undefined;
        const r = p.resource as { active?: boolean } | undefined;
        if (prev !== undefined && r?.active !== undefined && prev !== r.active) {
          await this.bumpResources(r.active ? 1 : -1);
        }
        break;
      }

      case 'core.reservation.created': {
        const res = p.reservation as { status?: string } | undefined;
        const st = res?.status ?? 'PENDING';
        await this.bumpReservationStatus(st, 1);
        break;
      }

      case 'core.reservation.updated': {
        const prev = p.previousStatus as string | undefined;
        const res = p.reservation as { status?: string } | undefined;
        const next = res?.status;
        if (prev && next && prev !== next) {
          await this.shiftReservation(prev, next);
        }
        break;
      }

      case 'core.reservation.approved':
        await this.shiftReservation('PENDING', 'APPROVED');
        break;

      case 'core.reservation.rejected':
        await this.shiftReservation('PENDING', 'REJECTED');
        break;

      case 'core.reservation.cancelled': {
        const prev = p.previousStatus as string | undefined;
        if (prev) {
          await this.shiftReservation(prev, 'CANCELLED');
        }
        break;
      }

      default:
        break;
    }
  }

  private async bumpDepartments(delta: number) {
    await this.model.findOneAndUpdate(
      { key: KEY },
      {
        $inc: { departmentsActive: delta },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true },
    );
  }

  private async bumpResources(delta: number) {
    await this.model.findOneAndUpdate(
      { key: KEY },
      {
        $inc: { resourcesActive: delta },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true },
    );
  }

  private async bumpReservationStatus(status: string, delta: number) {
    await this.model.findOneAndUpdate(
      { key: KEY },
      {
        $inc: { [`reservationsByStatus.${status}`]: delta },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true },
    );
  }

  private async shiftReservation(from: string, to: string) {
    await this.model.findOneAndUpdate(
      { key: KEY },
      {
        $inc: {
          [`reservationsByStatus.${from}`]: -1,
          [`reservationsByStatus.${to}`]: 1,
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true },
    );
  }

  /** Recalcula agregados a partir de contagens fornecidas (reconciliação). */
  async reconcile(snapshot: {
    departmentsActive: number;
    resourcesActive: number;
    reservationsByStatus: Record<string, number>;
  }) {
    await this.model.findOneAndUpdate(
      { key: KEY },
      {
        $set: {
          departmentsActive: snapshot.departmentsActive,
          resourcesActive: snapshot.resourcesActive,
          reservationsByStatus: snapshot.reservationsByStatus,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
    return this.getDashboard();
  }
}
