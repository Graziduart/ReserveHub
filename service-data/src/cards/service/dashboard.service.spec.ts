import { DashboardService } from './dashboard.service';

describe('DashboardService.applyEnvelope', () => {
  const model = {
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    }),
  };
  const service = new DashboardService(model as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('incrementa departamentos em core.department.created', async () => {
    await service.applyEnvelope({
      eventId: '1',
      occurredAt: new Date().toISOString(),
      routingKey: 'core.department.created',
      payload: { department: { active: true } },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'default' },
      expect.objectContaining({ $inc: { departmentsActive: 1 } }),
      expect.any(Object),
    );
  });

  it('ajusta active em core.resource.updated', async () => {
    await service.applyEnvelope({
      eventId: '2',
      occurredAt: new Date().toISOString(),
      routingKey: 'core.resource.updated',
      payload: { resource: { active: false }, previousActive: true },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'default' },
      expect.objectContaining({ $inc: { resourcesActive: -1 } }),
      expect.any(Object),
    );
  });

  it('decrementa departamentos em core.department.disabled', async () => {
    await service.applyEnvelope({
      eventId: '3',
      occurredAt: new Date().toISOString(),
      routingKey: 'core.department.disabled',
      payload: {},
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'default' },
      expect.objectContaining({ $inc: { departmentsActive: -1 } }),
      expect.any(Object),
    );
  });

  it('incrementa reservas pendentes em core.reservation.created', async () => {
    await service.applyEnvelope({
      eventId: '4',
      occurredAt: new Date().toISOString(),
      routingKey: 'core.reservation.created',
      payload: { reservation: { status: 'PENDING' } },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'default' },
      expect.objectContaining({
        $inc: { 'reservationsByStatus.PENDING': 1 },
      }),
      expect.any(Object),
    );
  });

  it('transfere PENDING para APPROVED em core.reservation.approved', async () => {
    await service.applyEnvelope({
      eventId: '5',
      occurredAt: new Date().toISOString(),
      routingKey: 'core.reservation.approved',
      payload: {},
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'default' },
      expect.objectContaining({
        $inc: {
          'reservationsByStatus.PENDING': -1,
          'reservationsByStatus.APPROVED': 1,
        },
      }),
      expect.any(Object),
    );
  });
});

describe('DashboardService.getDashboard', () => {
  it('retorna zeros quando não há documento', async () => {
    const model = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    };
    const service = new DashboardService(model as never);
    const dash = await service.getDashboard();
    expect(dash).toEqual({
      key: 'default',
      departmentsActive: 0,
      resourcesActive: 0,
      reservationsByStatus: {},
      updatedAt: null,
    });
  });
});

describe('DashboardService.reconcile', () => {
  it('grava snapshot e devolve dashboard', async () => {
    const doc = {
      key: 'default',
      departmentsActive: 5,
      resourcesActive: 10,
      reservationsByStatus: { PENDING: 2 },
      updatedAt: new Date(),
    };
    const model = {
      findOneAndUpdate: jest.fn().mockResolvedValue(doc),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(doc),
        }),
      }),
    };
    const service = new DashboardService(model as never);
    const result = await service.reconcile({
      departmentsActive: 5,
      resourcesActive: 10,
      reservationsByStatus: { PENDING: 2 },
    });
    expect(model.findOneAndUpdate).toHaveBeenCalled();
    expect(result.departmentsActive).toBe(5);
  });
});
