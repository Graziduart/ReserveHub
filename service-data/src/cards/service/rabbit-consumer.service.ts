import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Channel, ChannelModel } from 'amqplib';
import {
  DashboardService,
  DomainEnvelope,
} from './dashboard.service';

@Injectable()
export class RabbitConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumerService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  private readonly exchange =
    process.env.RABBITMQ_EXCHANGE ?? 'reservehub.events';
  private readonly queue =
    process.env.RABBITMQ_DATA_QUEUE ?? 'data.events';
  private readonly binding =
    process.env.RABBITMQ_BINDING_PATTERN ?? 'core.#';
  private dlq = '';

  constructor(private readonly dashboard: DashboardService) {}

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      this.logger.warn('RABBITMQ_URL ausente — consumidor data desligado');
      return;
    }
    try {
      const amqp = await import('amqplib');
      const conn = await amqp.connect(url);
      this.connection = conn;
      this.channel = await conn.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });
      this.dlq = `${this.queue}.dlq`;
      await this.channel.assertQueue(this.dlq, { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });
      await this.channel.bindQueue(this.queue, this.exchange, this.binding);
      await this.channel.prefetch(20);

      await this.channel.consume(this.queue, (msg) => {
        void this.handleMessage(msg);
      });

      this.logger.log(
        `Consumindo fila "${this.queue}" (${this.binding} em ${this.exchange})`,
      );
    } catch (e) {
      this.logger.error('Falha ao iniciar consumidor RabbitMQ (data)', e as Error);
      this.channel = null;
      this.connection = null;
    }
  }

  private async handleMessage(msg: import('amqplib').ConsumeMessage | null) {
    if (!msg || !this.channel) {
      return;
    }
    try {
      const raw = JSON.parse(msg.content.toString()) as unknown;
      if (!this.isEnvelope(raw)) {
        this.channel.ack(msg);
        return;
      }
      await this.dashboard.applyEnvelope(raw);
      this.channel.ack(msg);
    } catch (e) {
      this.logger.warn(`Erro ao processar evento: ${String(e)}`);
      if (this.dlq) {
        this.channel.sendToQueue(this.dlq, msg.content, { persistent: true });
      }
      this.channel.ack(msg);
    }
  }

  private isEnvelope(v: unknown): v is DomainEnvelope {
    if (!v || typeof v !== 'object') {
      return false;
    }
    const o = v as Record<string, unknown>;
    return (
      typeof o.eventId === 'string' &&
      typeof o.occurredAt === 'string' &&
      typeof o.routingKey === 'string' &&
      o.payload !== undefined &&
      typeof o.payload === 'object'
    );
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      /* noop */
    }
  }
}
