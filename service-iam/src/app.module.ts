import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthController } from './shared/health/health.controller';
import { UserController } from './users/user.controller';
import { UserService } from './users/user.service';
import { RolesGuard } from './rbac/roles.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController, UserController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    RolesGuard,
    UserService,
  ],
})
export class AppModule {}
