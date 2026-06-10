import { useMemo } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Reserva } from '../../data/types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const CHIP_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-teal-600',
  'bg-sky-600',
];

function colorForResource(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % CHIP_COLORS.length;
  return CHIP_COLORS[hash];
}

function toDateKey(data: string) {
  return data;
}

type Props = {
  reservas: Reserva[];
  month: Date;
  selectedDate: Date;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
};

export function ReservationCalendar({
  reservas,
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: Props) {
  const byDate = useMemo(() => {
    const map = new Map<string, Reserva[]>();
    for (const r of reservas) {
      const key = toDateKey(r.data);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return map;
  }, [reservas]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthLabel = format(month, 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onMonthChange(subMonths(month, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold capitalize text-gray-900">
            {monthLabel}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const today = new Date();
            onMonthChange(today);
            onSelectDate(today);
          }}
        >
          Hoje
        </Button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/80">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const events = byDate.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                'min-h-[7.5rem] p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
                !inMonth && 'bg-gray-50/60',
                inMonth && 'bg-white hover:bg-blue-50/40',
                selected && 'bg-blue-50 ring-1 ring-inset ring-blue-200',
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                    !inMonth && 'text-gray-300',
                    inMonth && !today && !selected && 'text-gray-700',
                    today && 'bg-blue-600 text-white shadow-sm',
                    selected && !today && 'bg-blue-100 text-blue-800',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {events.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                    {events.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {events.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className={cn(
                      'truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm',
                      colorForResource(ev.recursoId),
                    )}
                    title={`${ev.recurso} · ${ev.horaInicio}–${ev.horaFim}`}
                  >
                    <span className="opacity-90">{ev.horaInicio}</span>{' '}
                    {ev.recurso}
                  </div>
                ))}
                {events.length > 3 && (
                  <p className="text-[10px] font-medium text-gray-500 pl-0.5">
                    +{events.length - 3} mais
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DayPanelProps = {
  date: Date;
  reservas: Reserva[];
};

export function ReservationDayPanel({ date, reservas }: DayPanelProps) {
  const dayReservas = useMemo(
    () =>
      [...reservas]
        .filter((r) => r.data === format(date, 'yyyy-MM-dd'))
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [date, reservas],
  );

  const title = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Agenda do dia
        </p>
        <h3 className="mt-1 text-lg font-semibold capitalize text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {dayReservas.length} reserva(s) aprovada(s)
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {dayReservas.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-gray-400">
            <p className="text-sm">Nenhuma reserva neste dia</p>
          </div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[2.65rem] top-2 bottom-2 w-px bg-gray-200" />
            {dayReservas.map((r) => (
              <div key={r.id} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="w-11 shrink-0 pt-1 text-right text-xs font-semibold text-gray-500">
                  {r.horaInicio}
                </div>
                <div
                  className={cn(
                    'relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white',
                    colorForResource(r.recursoId),
                  )}
                />
                <div className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50/80 p-3 shadow-sm">
                  <p className="font-semibold text-gray-900">{r.recurso}</p>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {r.horaInicio} – {r.horaFim}
                  </p>
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-medium text-gray-500">Solicitante:</span>{' '}
                    {r.solicitante}
                  </p>
                  <p className="text-sm text-gray-600">{r.departamento}</p>
                  {r.motivo && (
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">{r.motivo}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
