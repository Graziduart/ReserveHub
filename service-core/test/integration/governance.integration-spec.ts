/**
 * Integração com Postgres real — só corre com RUN_INTEGRATION_DB=1 e DATABASE_URL.
 * Ex.: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/reserveHub?schema=core npm run test:e2e --prefix service-core -- --testPathPattern=integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/database/prisma.service';

const runIntegration = process.env.RUN_INTEGRATION_DB === '1';

(runIntegration ? describe : describe.skip)(
  'Governance + reports (integration DB)',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let adminToken: string;

    beforeAll(async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL required for integration tests');
      }
      process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();

      prisma = app.get(PrismaService);
      const jwt = app.get(JwtService);
      const admin = await prisma.user.findFirst({
        where: { role: Role.ADMIN },
      });
      if (!admin) {
        throw new Error('Seed required: no ADMIN user in core.users');
      }
      adminToken = jwt.sign({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        departmentId: admin.departmentId,
      });
    }, 60000);

    afterAll(async () => {
      await app?.close();
    });

    it('GET /reports/cost-allocation returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/cost-allocation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /reservations returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('EMPLOYEE cannot access cost-allocation', async () => {
      const emp = await prisma.user.findFirst({
        where: { role: Role.EMPLOYEE },
      });
      if (!emp) return;
      const jwt = app.get(JwtService);
      const token = jwt.sign({
        sub: emp.id,
        email: emp.email,
        role: emp.role,
        departmentId: emp.departmentId,
      });
      await request(app.getHttpServer())
        .get('/reports/cost-allocation')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  },
);
