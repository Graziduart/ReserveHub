import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/shared/database/prisma.service';

describe('service-core (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'e2e-test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
        department: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        reservation: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ active: true }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({
      ok: true,
      service: 'service-core',
    });
  });

  it('GET /departments without token returns 401', async () => {
    await request(app.getHttpServer()).get('/departments').expect(401);
  });

  it('GET /departments with valid Bearer returns list', async () => {
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync({
      sub: 'e2e-user-id',
      email: 'e2e@test.local',
      role: Role.ADMIN,
      departmentId: 'e2e-dept-id',
    });
    const res = await request(app.getHttpServer())
      .get('/departments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /resources without token returns 401', async () => {
    await request(app.getHttpServer()).get('/resources').expect(401);
  });

  it('GET /reservations without token returns 401', async () => {
    await request(app.getHttpServer()).get('/reservations').expect(401);
  });

  it('GET /reports/cost-allocation as EMPLOYEE returns 403', async () => {
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync({
      sub: 'emp-1',
      email: 'emp@test.local',
      role: Role.EMPLOYEE,
      departmentId: 'dept-1',
    });
    await request(app.getHttpServer())
      .get('/reports/cost-allocation')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /reports/cost-allocation as ADMIN returns list', async () => {
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync({
      sub: 'admin-1',
      email: 'admin@test.local',
      role: Role.ADMIN,
      departmentId: 'dept-1',
    });
    const res = await request(app.getHttpServer())
      .get('/reports/cost-allocation')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  afterEach(async () => {
    await app.close();
  });
});
