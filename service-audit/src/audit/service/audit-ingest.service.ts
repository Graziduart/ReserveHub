import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { AuditEvent } from '../schemas/audit-event.schema';



export type DomainEnvelope = {

  eventId: string;

  occurredAt: string;

  routingKey: string;

  payload: Record<string, unknown>;

};



export type AuditQuery = {

  limit?: number;

  routingKey?: string;

  from?: string;

  to?: string;

  cursor?: string;

};



@Injectable()

export class AuditIngestService {

  private readonly logger = new Logger(AuditIngestService.name);



  constructor(

    @InjectModel(AuditEvent.name)

    private readonly model: Model<AuditEvent>,

  ) {}



  async saveEnvelope(env: DomainEnvelope) {

    try {

      await this.model.create({

        eventId: env.eventId,

        routingKey: env.routingKey,

        occurredAt: new Date(env.occurredAt),

        payload: env.payload,

        receivedAt: new Date(),

      });

    } catch (e) {

      const code = (e as { code?: number }).code;

      if (code === 11000) {

        this.logger.debug(`Evento duplicado ignorado: ${env.eventId}`);

        return;

      }

      throw e;

    }

  }



  async findRecent(query: AuditQuery = {}) {

    const n = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const filter: Record<string, unknown> = {};

    if (query.routingKey) {

      filter.routingKey = query.routingKey;

    }

    if (query.from || query.to) {

      const receivedAt: Record<string, Date> = {};

      if (query.from) {

        receivedAt.$gte = new Date(query.from);

      }

      if (query.to) {

        receivedAt.$lte = new Date(query.to);

      }

      filter.receivedAt = receivedAt;

    }

    if (query.cursor) {

      filter.receivedAt = {

        ...(filter.receivedAt as Record<string, Date>),

        $lt: new Date(query.cursor),

      };

    }

    return this.model

      .find(filter)

      .sort({ receivedAt: -1 })

      .limit(n)

      .lean()

      .exec();

  }



  logParseError(err: unknown) {

    this.logger.warn(`Evento inválido ignorado: ${String(err)}`);

  }

}

