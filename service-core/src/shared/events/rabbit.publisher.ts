import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Channel, ChannelModel } from 'amqplib';
import { randomUUID } from 'crypto';
import type { CoreRoutingKey } from './event-routing';

@Injectable()
export class RabbitPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitPublisherService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  private readonly exchange =
    process.env.RABBITMQ_EXCHANGE ?? 'reservehub.events';

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      this.logger.warn('RABBITMQ_URL não definido — eventos de domínio desativados');
      return;
    }
    try {
      const amqp = await import('amqplib');
      const conn = await amqp.connect(url);
      conn.on('error', (err) => {
        this.logger.warn(`RabbitMQ connection error: ${(err as Error).message}`);
      });
      conn.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — publisher desativado');
        this.channel = null;
        this.connection = null;
      });
      this.connection = conn;
      this.channel = await conn.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      this.logger.log(`RabbitMQ publisher OK (exchange=${this.exchange})`);
    } catch (e) {
      this.logger.error('Falha ao conectar RabbitMQ no core', e as Error);
      this.channel = null;
      this.connection = null;
    }
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      /* noop */
    }
  }

  /** Publica envelope JSON com eventId e occurredAt (UTC ISO). */
  publish(routingKey: CoreRoutingKey, payload: Record<string, unknown>): void {
    if (!this.channel) {
      return;
    }
    const envelope = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      routingKey,
      payload,
    };
    const buf = Buffer.from(JSON.stringify(envelope));
    const ok = this.channel.publish(this.exchange, routingKey, buf, {
      persistent: true,
      contentType: 'application/json',
    });
    if (!ok) {
      this.logger.warn(`Buffer RabbitMQ cheio ao publicar ${routingKey}`);
    }
  }
}
