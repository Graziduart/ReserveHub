import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Calendar, ClipboardList, CheckCircle, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getDashboardSummary,
  getReservationsByDepartment,
  type DashboardSummary,
} from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function Dashboard() {
  const { reservas, recursos } = useApp();
  const [eventSummary, setEventSummary] = useState<DashboardSummary | null>(null);
  const [reservasPorDepartamento, setReservasPorDepartamento] = useState<
    { nome: string; total: number }[]
  >([]);

  useEffect(() => {
    getDashboardSummary()
      .then(setEventSummary)
      .catch(() => setEventSummary(null));
  }, [reservas.length]);

  useEffect(() => {
    getReservationsByDepartment()
      .then((rows) =>
        setReservasPorDepartamento(
          rows.map((r) => ({ nome: r.departamento, total: r.total })),
        ),
      )
      .catch(() => setReservasPorDepartamento([]));
  }, [reservas.length]);

  const hoje = new Date().toISOString().split('T')[0];

  // Estatísticas
  const stats = {
    reservasHoje: reservas.filter(r => r.data === hoje).length,
    pendentes: reservas.filter(r => r.status === 'pending').length,
    aprovadas: reservas.filter(r => r.status === 'approved').length,
    rejeitadas: reservas.filter(r => r.status === 'rejected').length,
  };

  // Próximas reservas aprovadas
  const proximasReservas = reservas
    .filter(r => r.status === 'approved' && new Date(r.data) >= new Date())
    .sort((a, b) => {
      const dateA = new Date(a.data + 'T' + a.horaInicio);
      const dateB = new Date(b.data + 'T' + b.horaInicio);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  // Recursos mais utilizados
  const recursosMaisUtilizados = recursos.map(recurso => {
    const totalReservas = reservas.filter(r => r.recursoId === recurso.id && r.status === 'approved').length;
    return {
      nome: recurso.nome,
      total: totalReservas,
      utilizacao: Math.min(totalReservas * 15, 100),
    };
  })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Dados para gráfico de pizza - Status das Reservas
  const byStatus = eventSummary?.reservationsByStatus ?? {};
  const statusData = [
    {
      name: 'Pendentes',
      value: byStatus.PENDING ?? stats.pendentes,
    },
    {
      name: 'Aprovadas',
      value: byStatus.APPROVED ?? stats.aprovadas,
    },
    {
      name: 'Rejeitadas',
      value: byStatus.REJECTED ?? stats.rejeitadas,
    },
  ];

  const formatData = (data: string) => {
    const [, mes, dia] = data.split('-');
    return `${dia}/${mes}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Visão geral das reservas e recursos
          {eventSummary?.updatedAt && (
            <span className="block text-xs mt-1 text-gray-500">
              Eventos (service-data): {eventSummary.departmentsActive} dept. ·{' '}
              {eventSummary.resourcesActive} recursos
            </span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reservas Hoje</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stats.reservasHoje}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stats.pendentes}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-yellow-500 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aprovadas</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stats.aprovadas}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Recursos</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{recursos.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reservas por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            {reservasPorDepartamento.length === 0 ? (
              <p className="text-center text-gray-500 py-12">Sem dados de departamentos</p>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reservasPorDepartamento}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="nome"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={72}
                  tick={{ fontSize: 11 }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status das Reservas</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Reservas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximasReservas.length > 0 ? (
                proximasReservas.map((reserva) => (
                  <div key={reserva.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{reserva.recurso}</p>
                      <p className="text-sm text-gray-600">{reserva.solicitante}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">{formatData(reserva.data)}</p>
                      <p className="text-sm text-gray-600">{reserva.horaInicio} - {reserva.horaFim}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">Nenhuma reserva próxima</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recursos Mais Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recursosMaisUtilizados.map((recurso, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{recurso.nome}</p>
                    <p className="text-sm text-gray-600">{recurso.total} reservas</p>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${recurso.utilizacao}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
