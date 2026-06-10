import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import { ResourceService } from '../service/ResourceService';
import { ResourceRequestDto } from '../dtos/ResourceRequest.dto';
import { ResourceResponseDto } from '../dtos/ResourceResponse.dto';
import { GenericResponseDto } from '../../shared/dto/GenericResponse.dto';

@Controller('resources')
export class ResourceController {
  constructor(
    @Inject(forwardRef(() => ResourceService))
    private readonly resourceService: ResourceService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() data: ResourceRequestDto): Promise<ResourceResponseDto> {
    return this.resourceService.create(data);
  }
  @Get()
  async findAll(): Promise<ResourceResponseDto[]> {
    return this.resourceService.findAll();
  }
  @Get(':id')
  async findById(@Param('id') id: string): Promise<ResourceResponseDto> {
    return this.resourceService.findById(id);
  }
  @Put(':id')
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() data: ResourceRequestDto,
  ): Promise<ResourceResponseDto> {
    return this.resourceService.update(id, data);
  }
  @Delete(':id')
  @Roles(Role.ADMIN)
  async disable(@Param('id') id: string): Promise<GenericResponseDto> {
    return this.resourceService.disable(id);
  }
}
