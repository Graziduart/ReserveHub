import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../shared/database/prisma.service';
import { hashPassword } from '../shared/crypto/password-hash';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { UserCreateDto, UserUpdateDto } from './dtos/user-request.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import {
  deactivateUserInCore,
  syncUserToCore,
} from '../shared/sync/core-user.sync';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    name: string;
    email: string;
    role: Role;
    departmentId: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }): UserResponseDto {
    return new UserResponseDto(row);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return this.toDto(row);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(dto: UserCreateDto): Promise<UserResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (exists) {
      throw new ConflictException('Email already registered');
    }
    const row = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        password: hashPassword(dto.password),
        role: dto.role,
        departmentId: dto.departmentId,
      },
    });
    await syncUserToCore(this.prisma, row);
    return this.toDto(row);
  }

  async update(
    id: string,
    dto: UserUpdateDto,
    actor: JwtUserPayload,
  ): Promise<UserResponseDto> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('User not found');
    }
    if (actor.role !== 'ADMIN' && actor.sub !== id) {
      throw new ForbiddenException();
    }
    if (actor.role !== 'ADMIN' && actor.sub === id) {
      if (
        dto.role !== undefined ||
        dto.departmentId !== undefined ||
        dto.active !== undefined ||
        dto.password !== undefined
      ) {
        throw new ForbiddenException('Cannot change restricted fields');
      }
    }

    if (dto.email !== undefined) {
      const nextEmail = dto.email.trim().toLowerCase();
      if (nextEmail !== current.email) {
        const taken = await this.prisma.user.findUnique({
          where: { email: nextEmail },
        });
        if (taken) {
          throw new ConflictException('Email already registered');
        }
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (actor.role === 'ADMIN') {
      if (dto.role !== undefined) data.role = dto.role;
      if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
      if (dto.active !== undefined) data.active = dto.active;
      if (dto.password !== undefined) data.password = hashPassword(dto.password);
    }

    const row = await this.prisma.user.update({
      where: { id },
      data,
    });
    await syncUserToCore(this.prisma, row);
    return this.toDto(row);
  }

  async deactivate(id: string): Promise<void> {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await deactivateUserInCore(this.prisma, id);
  }
}
