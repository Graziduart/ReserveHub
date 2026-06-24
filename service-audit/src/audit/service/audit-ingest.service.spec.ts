import { AuditIngestService } from './audit-ingest.service';

describe('AuditIngestService', () => {
  const create = jest.fn();
  const find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
  });
  const model = { create, find };
  const service = new AuditIngestService(model as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saveEnvelope persiste evento', async () => {
    await service.saveEnvelope({
      eventId: 'evt-1',
      occurredAt: '2026-05-21T12:00:00.000Z',
      routingKey: 'core.reservation.created',
      payload: { reservation: { id: 'r1' } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        routingKey: 'core.reservation.created',
      }),
    );
  });

  it('saveEnvelope ignora duplicado (code 11000)', async () => {
    create.mockRejectedValueOnce({ code: 11000 });
    await expect(
      service.saveEnvelope({
        eventId: 'dup',
        occurredAt: '2026-05-21T12:00:00.000Z',
        routingKey: 'core.reservation.created',
        payload: {},
      }),
    ).resolves.toBeUndefined();
  });

  it('saveEnvelope propaga outros erros', async () => {
    create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.saveEnvelope({
        eventId: 'err',
        occurredAt: '2026-05-21T12:00:00.000Z',
        routingKey: 'x',
        payload: {},
      }),
    ).rejects.toThrow('db down');
  });

  it('findRecent limita entre 1 e 200', async () => {
    const limit = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    const sort = jest.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    await service.findRecent({ limit: 500 });
    expect(limit).toHaveBeenCalledWith(200);

    await service.findRecent({ limit: 0 });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('findRecent aplica routingKey e cursor', async () => {
    const limit = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      }),
    });
    const sort = jest.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    const rows = await service.findRecent({
      routingKey: 'core.reservation.approved',
      cursor: '2026-05-21T10:00:00.000Z',
      limit: 10,
    });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        routingKey: 'core.reservation.approved',
        receivedAt: expect.objectContaining({
          $lt: expect.any(Date),
        }),
      }),
    );
    expect(rows).toEqual([{ id: 'a1' }]);
  });
});
