import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/** Valida JWT emitidos pelo service-iam (mesmo `JWT_SECRET`). */
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret:
        process.env.JWT_SECRET ?? 'reservehub-dev-jwt-secret-change-in-production',
    }),
  ],
})
export class CoreJwtModule {}
