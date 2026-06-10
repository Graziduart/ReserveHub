import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ResourceRequestDto } from '../dtos/ResourceRequest.dto';
import { ResourceResponseDto } from '../dtos/ResourceResponse.dto';
import { GenericResponseDto } from '../../shared/dto/GenericResponse.dto';
import { RabbitPublisherService } from '../../shared/events/rabbit.publisher';
import { CORE_EVENTS } from '../../shared/events/event-routing';
import { toEventJson } from '../../shared/events/event-serialize';

@Injectable()
export class ResourceService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RabbitPublisherService)
    private readonly events: RabbitPublisherService,
  ) {}

  private async assertDepartment(id: string | undefined) {
    if (!id) return;
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept || !dept.active) {
      throw new NotFoundException('Department not found or inactive');
    }
  }

  async create(data: ResourceRequestDto): Promise<ResourceResponseDto> {
    await this.assertDepartment(data.departmentId);
    const resource = await this.prisma.resource.create({
      data: {
        name: data.name,
        type: data.type,
        location: data.location,
        requiresApproval: data.requiresApproval,
        departmentId: data.departmentId,
        costCenterCode: data.costCenterCode,
        description: data.description,
        capacity: data.capacity,
        category: data.category,
        characteristics: data.characteristics ?? [],
        active: data.active ?? true,
      },
      include: {
        department: { select: { id: true, name: true, sigla: true } },
      },
    });
    this.events.publish(CORE_EVENTS.RESOURCE_CREATED, {
      resource: toEventJson(resource),
    });
    return new ResourceResponseDto(resource);
  }

  async findAll(): Promise<ResourceResponseDto[]> {
    const resources = await this.prisma.resource.findMany({
      where: { active: true },
      include: {
        department: { select: { id: true, name: true, sigla: true } },
      },
    });
    return resources.map((resource) => new ResourceResponseDto(resource));
  }

  async findById(id: string): Promise<ResourceResponseDto> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, sigla: true } },
      },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
    return new ResourceResponseDto(resource);
  }

  async update(
    id: string,
    dto: ResourceRequestDto,
  ): Promise<ResourceResponseDto> {
    const previous = await this.findById(id);
    await this.assertDepartment(dto.departmentId);
    const resource = await this.prisma.resource.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        location: dto.location,
        requiresApproval: dto.requiresApproval,
        departmentId: dto.departmentId,
        costCenterCode: dto.costCenterCode,
        description: dto.description,
        capacity: dto.capacity,
        category: dto.category,
        characteristics: dto.characteristics,
        active: dto.active,
        updatedAt: new Date(),
      },
      include: {
        department: { select: { id: true, name: true, sigla: true } },
      },
    });
    this.events.publish(CORE_EVENTS.RESOURCE_UPDATED, {
      resource: toEventJson(resource),
      previousActive: previous.active,
    });
    return new ResourceResponseDto(resource);
  }

  async disable(id: string): Promise<GenericResponseDto> {
    await this.findById(id);

    const updated = await this.prisma.resource.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date(),
      },
    });
    this.events.publish(CORE_EVENTS.RESOURCE_DISABLED, {
      resource: toEventJson(updated),
    });
    return new GenericResponseDto('Resource deactivated successfully');
  }
}
