import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReservationStatus } from '@prisma/client';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';
import { ReservationRequestDto } from '../dtos/ReservationRequest.dto';
import { ReservationUpdateDto } from '../dtos/ReservationUpdate.dto';
import {
  ReservationService,
  ReservationListFilters,
} from '../service/ReservationService';

@Controller('reservations')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  create(
    @Body() data: ReservationRequestDto,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.reservationService.create(data, req.user);
  }

  @Get('availability')
  availability(
    @Query('resourceId') resourceId: string | undefined,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    if (!resourceId || !startDate || !endDate) {
      throw new BadRequestException(
        'Informe query params: resourceId, startDate, endDate (ISO-8601)',
      );
    }
    return this.reservationService.checkAvailability(
      resourceId,
      startDate,
      endDate,
      req.user,
    );
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Query('resourceId') resourceId?: string,
    @Query('userId') userId?: string,
    @Query('status') statusRaw?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: ReservationListFilters = {
      resourceId,
      userId,
      from,
      to,
    };
    if (statusRaw !== undefined && statusRaw !== '') {
      if (
        !Object.values(ReservationStatus).includes(
          statusRaw as ReservationStatus,
        )
      ) {
        throw new BadRequestException('Invalid status');
      }
      filters.status = statusRaw as ReservationStatus;
    }
    return this.reservationService.findAll(filters, req.user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.reservationService.findById(id, req.user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: ReservationUpdateDto,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.reservationService.update(id, data, req.user);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.reservationService.approve(id, req.user);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() data: ReservationUpdateDto,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.reservationService.reject(id, data, req.user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.reservationService.cancel(id, req.user);
  }
}
