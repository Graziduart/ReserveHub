import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, Filter, LayoutGrid, List } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ReservationCalendar,
  ReservationDayPanel,
} from '../components/agenda/ReservationCalendar';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export function Agenda() {
  const { reservas, recursos } = useApp();
  const [selectedRecurso, setSelectedRecurso] = useState<string>('all');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const reservasAprovadas = useMemo(
    () => reservas.filter((r) => r.status === 'approved'),
    [reservas],
  );

  const reservasFiltradas = useMemo(() => {
    if (selectedRecurso === 'all') return reservasAprovadas;
    return reservasAprovadas.filter((r) => r.recursoId === selectedRecurso);
  }, [reservasAprovadas, selectedRecurso]);

  const reservasPorData = useMemo(() => {
    const acc: Record<string, typeof reservasFiltradas> = {};
    for (const r of reservasFiltradas) {
      if (!acc[r.data]) acc[r.data] = [];
      acc[r.data].push(r);
    }
    return acc;
  }, [reservasFiltradas]);

  const datas = useMemo(() => Object.keys(reservasPorData).sort(), [reservasPorData]);

  const formatDataLonga = (data: string) => {
    const [y, m, d] = data.split('-').map(Number);
    return format(new Date(y, m - 1, d), "EEE, d MMM yyyy", { locale: ptBR });
  };

  const proximaReserva = useMemo(() => {
    const now = new Date();
    return [...reservasFiltradas]
      .filter((r) => {
        const start = parseISO(`${r.data}T${r.horaInicio.length === 5 ? r.horaInicio + ':00' : r.horaInicio}`);
        return start >= now;
      })
      .sort((a, b) => {
        const da = parseISO(`${a.data}T${a.horaInicio}`);
        const db = parseISO(`${b.data}T${b.horaInicio}`);
        return da.getTime() - db.getTime();
      })[0];
  }, [reservasFiltradas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agenda</h1>
          <p className="mt-1 text-gray-600">
            Calendário de reservas aprovadas — dados em tempo real da API
          </p>
        </div>
        {proximaReserva && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-2 text-sm">
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-gray-700">
              Próxima:{' '}
              <strong className="text-gray-900">{proximaReserva.recurso}</strong>{' '}
              · {formatDataLonga(proximaReserva.data)} às {proximaReserva.horaInicio}
            </span>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <Filter className="h-5 w-5 text-gray-400 shrink-0" />
          <Select value={selectedRecurso} onValueChange={setSelectedRecurso}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Filtrar recurso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os recursos</SelectItem>
              {recursos.map((recurso) => (
                <SelectItem key={recurso.id} value={recurso.id}>
                  {recurso.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="font-normal">
            {reservasFiltradas.length} reserva(s) aprovada(s)
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendario" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="lista" className="gap-2">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-0">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
            <ReservationCalendar
              reservas={reservasFiltradas}
              month={month}
              selectedDate={selectedDate}
              onMonthChange={setMonth}
              onSelectDate={setSelectedDate}
            />
            <div className="min-h-[28rem] xl:sticky xl:top-20 xl:self-start">
              <ReservationDayPanel date={selectedDate} reservas={reservasFiltradas} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lista" className="mt-0 space-y-4">
          {datas.length > 0 ? (
            datas.map((data) => (
              <Card key={data} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold capitalize text-gray-900">
                    {formatDataLonga(data)}
                  </h2>
                  <Badge variant="outline" className="ml-auto">
                    {reservasPorData[data].length}
                  </Badge>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {reservasPorData[data]
                      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                      .map((reserva) => (
                        <div
                          key={reserva.id}
                          className="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-gray-50/80 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{reserva.recurso}</p>
                            <p className="text-sm text-gray-600">
                              {reserva.solicitante} · {reserva.departamento}
                            </p>
                            {reserva.motivo && (
                              <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                                {reserva.motivo}
                              </p>
                            )}
                          </div>
                          <Badge className="w-fit shrink-0 bg-blue-100 text-blue-800 hover:bg-blue-100">
                            {reserva.horaInicio} – {reserva.horaFim}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-gray-500">
                Nenhuma reserva aprovada encontrada
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
