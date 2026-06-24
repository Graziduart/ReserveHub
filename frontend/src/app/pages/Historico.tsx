import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ClipboardList, History, Info, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toAuditTableRow } from '../lib/audit-display';
import { AuditEventsTable } from '../components/audit/AuditEventsTable';
import { currentAuthRole, canViewAudit } from '../lib/auth-roles';

export function Historico() {
  const { registrosAuditoria } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const isColaborador = currentAuthRole() === 'EMPLOYEE';
  const podeVerAuditoria = canViewAudit();

  const rows = useMemo(
    () => registrosAuditoria.map(toAuditTableRow),
    [registrosAuditoria],
  );

  const logsFiltrados = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return rows.filter((row) => {
      const blob = [
        row.utilizador,
        row.acaoLabel,
        row.alvo,
        row.resumo,
        row.entidadeId ?? '',
        row.data,
      ]
        .join(' ')
        .toLowerCase();
      const matchSearch = !q || blob.includes(q);
      const matchTipo = filtroTipo === 'all' || row.tipo === filtroTipo;
      return matchSearch && matchTipo;
    });
  }, [rows, searchTerm, filtroTipo]);

  const tipos = Array.from(new Set(rows.map((r) => r.tipo)));

  const tipoLabels: Record<string, string> = {
    reserva_criada: 'Reserva Criada',
    reserva_aprovada: 'Reserva Aprovada',
    reserva_rejeitada: 'Reserva Rejeitada',
    reserva_cancelada: 'Reserva Cancelada',
    recurso_criado: 'Recurso',
    departamento: 'Departamento',
    auditoria: 'Outros',
  };

  const stats = useMemo(() => {
    const count = (t: string) => rows.filter((r) => r.tipo === t).length;
    return {
      criadas: count('reserva_criada'),
      aprovadas: count('reserva_aprovada'),
      rejeitadas: count('reserva_rejeitada'),
      recursos: count('recurso_criado'),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Histórico de Atividades</h1>
        {isColaborador ? (
          <p className="text-gray-600 mt-1">
            O histórico global de auditoria é restrito a gestores e administradores. Como
            colaborador, acompanhe o estado das suas reservas na página{' '}
            <Link to="/reservas" className="font-medium text-blue-600 hover:underline">
              Reservas
            </Link>
            .
          </p>
        ) : (
          <p className="text-gray-600 mt-1">
            Eventos de auditoria centralizados (Rabbit / serviço audit). Se vazio, confirme
            que o service-audit está a correr na porta 3003.
          </p>
        )}
      </div>

      {isColaborador && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Acesso limitado ao seu perfil</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Esta área regista ações de toda a organização (criação de reservas,
                    aprovações, alterações de recursos). Colaboradores não consultam essa
                    trilha por política de segurança (RBAC).
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Para ver pedidos pendentes, aprovados ou rejeitados que você criou, use
                    a lista de reservas.
                  </p>
                </div>
              </div>
              <Link
                to="/reservas"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ClipboardList className="w-4 h-4" />
                Ir para Reservas
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {podeVerAuditoria && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Utilizador, ação, alvo, detalhes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipoLabels[tipo] ?? tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {isColaborador ? 'Auditoria organizacional' : `Auditoria (${logsFiltrados.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditEventsTable
            rows={isColaborador ? [] : logsFiltrados}
            emptyMessage={
              isColaborador
                ? 'Sem acesso à auditoria global. Consulte as suas reservas em Reservas.'
                : registrosAuditoria.length === 0
                  ? 'Nenhum evento de auditoria — confirme que o serviço audit está a correr.'
                  : 'Nenhuma atividade encontrada com os filtros actuais.'
            }
          />
        </CardContent>
      </Card>

      {podeVerAuditoria && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.criadas}</p>
              <p className="text-sm text-gray-600 mt-1">Reservas Criadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.aprovadas}</p>
              <p className="text-sm text-gray-600 mt-1">Reservas Aprovadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rejeitadas}</p>
              <p className="text-sm text-gray-600 mt-1">Reservas Rejeitadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.recursos}</p>
              <p className="text-sm text-gray-600 mt-1">Recursos / Dept.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
