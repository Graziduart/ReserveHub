import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditEventDocument = HydratedDocument<AuditEvent>;

@Schema({ collection: 'audit_events' })
export class AuditEvent {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ required: true, index: true })
  routingKey: string;

  @Prop({ required: true })
  occurredAt: Date;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ default: () => new Date() })
  receivedAt: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);

/** Retenção de 90 dias (ajustável via índice TTL no MongoDB). */
AuditEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
