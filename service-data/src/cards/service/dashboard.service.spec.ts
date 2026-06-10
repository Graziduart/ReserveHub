import { DashboardService } from './dashboard.service';

describe('DashboardService.applyEnvelope', () => {
  const model = {
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
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
});
