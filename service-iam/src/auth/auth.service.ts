import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../shared/database/prisma.service';
import { verifyPassword, hashPassword } from '../shared/crypto/password-hash';
import {
  createRefreshTokenOpaque,
  hashRefreshToken,
} from '../shared/crypto/refresh-token';
import type { JwtUserPayload } from './jwt-user.payload';
import { UserResponseDto } from '../users/dtos/user-response.dto';

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSec: number;
  user: UserResponseDto;
};

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    this.googleClient = clientId ? new OAuth2Client(clientId) : null;
  }

  isGoogleAuthEnabled(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
  }

  private accessExpiresSec(): number {
    return Number(process.env.JWT_ACCESS_EXPIRES_SEC ?? 900);
  }

  private refreshExpiresMs(): number {
    const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7);
    return days * 24 * 60 * 60 * 1000;
  }

  private toUserDto(row: {
    id: string;
    name: string;
    email: string;
    role: import('@prisma/client').Role;
    departmentId: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }): UserResponseDto {
    return new UserResponseDto(row);
  }

  async issueTokensForUser(userId: string): Promise<AuthTokensResponse> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row || !row.active) {
      throw new UnauthorizedException('User not available');
    }
    const payload: JwtUserPayload = {
      sub: row.id,
      email: row.email,
      role: row.role,
      departmentId: row.departmentId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessExpiresSec(),
    });
    const { raw, hash } = createRefreshTokenOpaque();
    const expiresAt = new Date(Date.now() + this.refreshExpiresMs());
    await this.prisma.refreshToken.create({
      data: {
        userId: row.id,
        tokenHash: hash,
        expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken: raw,
      accessTokenExpiresInSec: this.accessExpiresSec(),
      user: this.toUserDto(row),
    };
  }

  async login(email: string, password: string): Promise<AuthTokensResponse> {
    const row = await this.prisma.user.findFirst({
      where: {
        email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
        active: true,
      },
    });
    if (!row || !verifyPassword(password, row.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.user.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokensForUser(row.id);
  }

  async loginWithGoogle(idToken: string): Promise<AuthTokensResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId || !this.googleClient) {
      throw new BadRequestException('Google Sign-In não está configurado no servidor');
    }

    let email: string | undefined;
    let emailVerified = false;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken.trim(),
        audience: clientId,
      });
      const payload = ticket.getPayload();
      email = payload?.email?.trim().toLowerCase();
      emailVerified = payload?.email_verified === true;
    } catch {
      throw new UnauthorizedException('Token Google inválido ou expirado');
    }

    if (!email || !emailVerified) {
      throw new UnauthorizedException('Conta Google sem e-mail verificado');
    }

    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase();
    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      throw new UnauthorizedException(
        `Domínio de e-mail não autorizado. Utilize @${allowedDomain}`,
      );
    }

    const row = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        active: true,
      },
    });
    if (!row) {
      throw new UnauthorizedException(
        'Utilizador não registado no ReserveHub. Peça ao administrador para criar a sua conta.',
      );
    }

    await this.prisma.user.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokensForUser(row.id);
  }

  async refresh(refreshTokenRaw: string): Promise<AuthTokensResponse> {
    const hash = hashRefreshToken(refreshTokenRaw);
    const rt = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: hash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!rt || !rt.user.active) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: rt.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokensForUser(rt.userId);
  }

  async logout(refreshTokenRaw: string): Promise<{ ok: boolean }> {
    const hash = hashRefreshToken(refreshTokenRaw);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async logoutAll(userId: string): Promise<{ ok: boolean }> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  getIdpConfig(): {
    enabled: boolean;
    provider?: string;
    issuer?: string;
    authorizationUrl?: string | null;
    passwordResetUrl?: string | null;
    googleEnabled?: boolean;
    googleClientId?: string | null;
  } {
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
    const issuer = process.env.IDP_ISSUER?.trim();
    if (!issuer) {
      return {
        enabled: false,
        googleEnabled: Boolean(googleClientId),
        googleClientId,
      };
    }
    return {
      enabled: true,
      provider: process.env.IDP_PROVIDER?.trim() || 'oidc',
      issuer,
      authorizationUrl: process.env.IDP_AUTHORIZATION_URL?.trim() || null,
      passwordResetUrl: process.env.IDP_PASSWORD_RESET_URL?.trim() || null,
      googleEnabled: Boolean(googleClientId),
      googleClientId,
    };
  }

  /** Delegado ao gestor de identidade corporativo (Keycloak, Entra ID, etc.). */
  forgotPassword(): never {
    const cfg = this.getIdpConfig();
    const hint = cfg.passwordResetUrl
      ? ` Utilize: ${cfg.passwordResetUrl}`
      : ' Contacte o administrador de TI.';
    throw new BadRequestException(
      `A recuperação de palavra-passe é feita pelo gestor de identidade corporativo.${hint}`,
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row || !verifyPassword(currentPassword, row.password)) {
      throw new UnauthorizedException('Invalid current password');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashPassword(newPassword) },
    });
    await this.logoutAll(userId);
    return { ok: true };
  }
}
