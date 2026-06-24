import type { Reserva } from '../data/types';

/** Horário corporativo padrão para visualização de disponibilidade (RF-04). */
export const WORK_DAY_START_HOUR = 8;
export const WORK_DAY_END_HOUR = 18;
export const SLOT_MINUTES = 60;

export type SlotStatus = 'free' | 'occupied-approved' | 'occupied-pending';

export type AvailabilitySlot = {
  start: string;
  end: string;
  status: SlotStatus;
  reserva?: Reserva;
};

function padHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function slotRange(startHour: number): { start: string; end: string } {
  return {
    start: padHour(startHour),
    end: padHour(startHour + SLOT_MINUTES / 60),
  };
}

function parseTimeOnDate(date: string, time: string): Date {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}`);
}

function overlapsSlot(
  reserva: Reserva,
  date: string,
  slotStart: string,
  slotEnd: string,
): boolean {
  const slotStartDt = parseTimeOnDate(date, slotStart);
  const slotEndDt = parseTimeOnDate(date, slotEnd);
  const resStart = parseTimeOnDate(reserva.data, reserva.horaInicio);
  const resEnd = parseTimeOnDate(reserva.data, reserva.horaFim);
  return resStart < slotEndDt && resEnd > slotStartDt;
}

/** Gera grelha horária com slots livres e ocupados para um dia/recurso. */
export function buildDayAvailabilitySlots(
  date: string,
  reservas: Reserva[],
  resourceId?: string,
): AvailabilitySlot[] {
  const blocking = reservas.filter(
    (r) =>
      r.data === date &&
      (r.status === 'approved' || r.status === 'pending') &&
      (!resourceId || resourceId === 'all' || r.recursoId === resourceId),
  );

  const slots: AvailabilitySlot[] = [];
  for (let h = WORK_DAY_START_HOUR; h < WORK_DAY_END_HOUR; h += SLOT_MINUTES / 60) {
    const { start, end } = slotRange(h);
    const overlapping = blocking.filter((r) => overlapsSlot(r, date, start, end));
    if (overlapping.length === 0) {
      slots.push({ start, end, status: 'free' });
      continue;
    }
    const approved = overlapping.find((r) => r.status === 'approved');
    const pick = approved ?? overlapping[0];
    slots.push({
      start,
      end,
      status: pick.status === 'approved' ? 'occupied-approved' : 'occupied-pending',
      reserva: pick,
    });
  }
  return slots;
}
