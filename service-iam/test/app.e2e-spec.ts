import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/shared/database/prisma.service';

describe('service-iam (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'e2e-iam-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u1',
            name: 'Test',
            email: 't@test.local',
            role: Role.ADMIN,
            departmentId: 'd1',
            active: true,
            password: 'x',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
          }),
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
    expect(res.body).toMatchObject({ ok: true, service: 'service-iam' });
  });

  it('GET /users/me with Bearer', async () => {
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync({
      sub: 'u1',
      email: 't@test.local',
      role: Role.ADMIN,
      departmentId: 'd1',
    });
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe('t@test.local');
  });

  it('GET /users/me without token returns 401', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('POST /auth/login without body returns 400', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });

  it('GET /auth/idp returns config', async () => {
    const res = await request(app.getHttpServer()).get('/auth/idp').expect(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('googleEnabled');
  });

  afterEach(async () => {
    await app.close();
  });
});
