import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Reserva } from '../../data/types';
import {
  buildDayAvailabilitySlots,
  type AvailabilitySlot,
} from '../../lib/agenda-availability';
import { cn } from '../../lib/utils';

type Props = {
  date: Date;
  reservas: Reserva[];
  resourceId: string;
};

const slotStyles: Record<AvailabilitySlot['status'], string> = {
  free: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  'occupied-approved': 'border-red-200 bg-red-50 text-red-900',
  'occupied-pending': 'border-amber-200 bg-amber-50 text-amber-900',
};

const slotLabels: Record<AvailabilitySlot['status'], string> = {
  free: 'Livre',
  'occupied-approved': 'Ocupado (aprovada)',
  'occupied-pending': 'Ocupado (pendente)',
};

export function ResourceAvailabilityTimeline({ date, reservas, resourceId }: Props) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const slots = useMemo(
    () => buildDayAvailabilitySlots(dateKey, reservas, resourceId),
    [dateKey, reservas, resourceId],
  );

  const title = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  const freeCount = slots.filter((s) => s.status === 'free').length;
  const occupiedCount = slots.length - freeCount;

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 to-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Disponibilidade do dia
        </p>
        <h3 className="mt-1 text-lg font-semibold capitalize text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {freeCount} horário(s) livre(s) · {occupiedCount} ocupado(s)
        </p>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-gray-100 px-5 py-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" />
          Livre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-red-300 bg-red-100" />
          Ocupado (aprovada)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" />
          Ocupado (pendente)
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => (
            <div
              key={`${slot.start}-${slot.end}`}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm shadow-sm',
                slotStyles[slot.status],
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {slot.start} – {slot.end}
                </span>
                <span className="text-xs font-medium opacity-90">{slotLabels[slot.status]}</span>
              </div>
              {slot.reserva && (
                <p className="mt-1 text-xs opacity-90">
                  {slot.reserva.recurso} · {slot.reserva.solicitante}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
