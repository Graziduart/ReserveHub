import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** POST /reservations — `userId` opcional (default: utilizador do token). */
export class ReservationRequestDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsUUID()
  @IsNotEmpty()
  resourceId!: string;

  @IsISO8601()
  @IsNotEmpty()
  startDate!: string;

  @IsISO8601()
  @IsNotEmpty()
  endDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
