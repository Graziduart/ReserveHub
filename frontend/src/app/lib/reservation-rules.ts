import type { Reserva } from '../data/types';

/** RN-04: alinhado com service-core (reservation-governance). */
export const CANCEL_MIN_LEAD_HOURS = 1;

const CANCEL_MIN_LEAD_MS = CANCEL_MIN_LEAD_HOURS * 60 * 60 * 1000;

export function reservationStartDate(
  reserva: Pick<Reserva, 'data' | 'horaInicio'>,
): Date {
  const time =
    reserva.horaInicio.length === 5 ? `${reserva.horaInicio}:00` : reserva.horaInicio;
  return new Date(`${reserva.data}T${time}`);
}

export function canCancelBeforeDeadline(
  startDate: Date,
  now: Date = new Date(),
): boolean {
  return startDate.getTime() - now.getTime() >= CANCEL_MIN_LEAD_MS;
}

export function canCancelReservation(reserva: Reserva): boolean {
  if (reserva.status !== 'pending' && reserva.status !== 'approved') {
    return false;
  }
  return canCancelBeforeDeadline(reservationStartDate(reserva));
}

export function cancelDeadlineMessage(): string {
  return `Só é possível cancelar até ${CANCEL_MIN_LEAD_HOURS} hora(s) antes do início da reserva.`;
}
