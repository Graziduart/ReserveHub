import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { UserService } from './user.service';
import { UserCreateDto, UserUpdateDto } from './dtos/user-request.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async me(
    @Req() req: Request & { user: JwtUserPayload },
  ): Promise<UserResponseDto> {
    return this.userService.findById(req.user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async findAll(
    @Req() req: Request & { user: JwtUserPayload },
  ): Promise<UserResponseDto[]> {
    return this.userService.findAll(req.user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUserPayload },
  ): Promise<UserResponseDto> {
    if (req.user.role !== Role.ADMIN && req.user.sub !== id) {
      throw new ForbiddenException();
    }
    return this.userService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: UserCreateDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UserUpdateDto,
    @Req() req: Request & { user: JwtUserPayload },
  ): Promise<UserResponseDto> {
    return this.userService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.userService.deactivate(id);
    return { ok: true };
  }
}
