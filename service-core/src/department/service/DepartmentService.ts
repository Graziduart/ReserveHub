import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { DepartmentRequestDto } from '../dtos/DepartmentRequest.dto';
import { DepartmentResponseDto } from '../dtos/DepartmentResponse.dto';
import { PrismaService } from '../../shared/database/prisma.service';
import { GenericResponseDto } from '../../shared/dto/GenericResponse.dto';
import { RabbitPublisherService } from '../../shared/events/rabbit.publisher';
import { CORE_EVENTS } from '../../shared/events/event-routing';
import { toEventJson } from '../../shared/events/event-serialize';
import { normalizeDepartmentName } from '../department-name.util';

@Injectable()
export class DepartmentService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RabbitPublisherService)
    private readonly events: RabbitPublisherService,
  ) {}

  private async findByNormalizedName(name: string, excludeId?: string) {
    const normalized = normalizeDepartmentName(name);
    if (!normalized) return null;
    return this.prisma.department.findFirst({
      where: {
        name: { equals: normalized, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  async create(data: DepartmentRequestDto): Promise<DepartmentResponseDto> {
    const name = normalizeDepartmentName(data.name);
    if (!name) {
      throw new ConflictException('Department name is required');
    }

    const nameTaken = await this.findByNormalizedName(name);
    if (nameTaken) {
      throw new ConflictException('Department name already registered');
    }

    const exits = await this.prisma.department.findUnique({
      where: {
        sigla: data.sigla,
      },
    });
    if (exits) {
      throw new ConflictException('Department acronym already registered');
    }
    const department = await this.prisma.department.create({
      data: {
        name,
        sigla: data.sigla,
        priority: data.priority ?? 0,
        costCenterCode: data.costCenterCode,
      },
    });
    this.events.publish(CORE_EVENTS.DEPARTMENT_CREATED, {
      department: toEventJson(department),
    });
    return new DepartmentResponseDto(department);
  }

  async findAll(): Promise<DepartmentResponseDto[]> {
    const departments = await this.prisma.department.findMany({
      where: {
        active: true,
      },
    });
    return departments.map(
      (department) => new DepartmentResponseDto(department),
    );
  }
  async findById(id: string): Promise<DepartmentResponseDto> {
    const department = await this.prisma.department.findUnique({
      where: {
        id: id,
      },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return new DepartmentResponseDto(department);
  }

  async disable(id: string): Promise<GenericResponseDto> {
    await this.findById(id);

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date(),
      },
    });
    this.events.publish(CORE_EVENTS.DEPARTMENT_DISABLED, {
      department: toEventJson(updated),
    });
    return new GenericResponseDto('Department deactivated successfully');
  }

  async update(
    id: string,
    data: DepartmentRequestDto,
  ): Promise<DepartmentResponseDto> {
    await this.findById(id);

    const name = normalizeDepartmentName(data.name);
    if (!name) {
      throw new ConflictException('Department name is required');
    }

    const nameTaken = await this.findByNormalizedName(name, id);
    if (nameTaken) {
      throw new ConflictException('Department name already registered');
    }

    const siglaTaken = await this.prisma.department.findUnique({
      where: { sigla: data.sigla },
    });
    if (siglaTaken && siglaTaken.id !== id) {
      throw new ConflictException('Department acronym already used');
    }

    const department = await this.prisma.department.update({
      where: {
        id: id,
      },
      data: {
        name,
        sigla: data.sigla,
        priority: data.priority ?? undefined,
        costCenterCode: data.costCenterCode,
        updatedAt: new Date(),
      },
    });
    this.events.publish(CORE_EVENTS.DEPARTMENT_UPDATED, {
      department: toEventJson(department),
    });
    return new DepartmentResponseDto(department);
  }
}
