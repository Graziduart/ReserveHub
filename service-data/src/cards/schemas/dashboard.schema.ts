import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DashboardDocument = HydratedDocument<DashboardSummary>;

@Schema({ collection: 'dashboard_summaries' })
export class DashboardSummary {
  @Prop({ unique: true, default: 'default' })
  key: string;

  @Prop({ default: 0 })
  departmentsActive: number;

  @Prop({ default: 0 })
  resourcesActive: number;

  /** contagens por ReservationStatus */
  @Prop({ type: Object, default: {} })
  reservationsByStatus: Record<string, number>;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const DashboardSummarySchema =
  SchemaFactory.createForClass(DashboardSummary);
