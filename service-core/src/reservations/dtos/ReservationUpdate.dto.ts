import { IsISO8601, IsOptional, IsString } from 'class-validator';

/**
 * PUT/PATCH reschedule (campos opcionais) ou POST reject (use só rejectReason).
 * Rejeição: envie apenas { "rejectReason": "..." }; demais campos são ignorados.
 */
export class ReservationUpdateDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  rejectReason?: string;
}
