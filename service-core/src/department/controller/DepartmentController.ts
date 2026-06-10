import { DepartmentService } from '../service/DepartmentService';
import { Body, Controller, Delete, Get, Post, Put, Inject, forwardRef } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import { DepartmentRequestDto } from '../dtos/DepartmentRequest.dto';
import { DepartmentResponseDto } from '../dtos/DepartmentResponse.dto';
import { Param } from '@nestjs/common';
import { GenericResponseDto } from '../../shared/dto/GenericResponse.dto';

@Controller('departments')
export class DepartmentController {
  constructor(
    @Inject(forwardRef(() => DepartmentService))
    private readonly departmentService: DepartmentService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(
    @Body() data: DepartmentRequestDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentService.create(data);
  }

  @Get()
  async findAll(): Promise<DepartmentResponseDto[]> {
    return this.departmentService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<DepartmentResponseDto> {
    return this.departmentService.findById(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async disable(@Param('id') id: string): Promise<GenericResponseDto> {
    return this.departmentService.disable(id);
  }
  @Put(':id')
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() data: DepartmentRequestDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentService.update(id, data);
  }
}
