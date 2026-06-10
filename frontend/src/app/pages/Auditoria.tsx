import { useMemo, useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { ServicoAuditoria } from '../data/types';
import { toAuditTableRow } from '../lib/audit-display';
import { AuditEventsTable } from '../components/audit/AuditEventsTable';
import { RequireRole } from '../components/auth/RequireRole';

function AuditoriaPage() {
  const { registrosAuditoria } = useApp();
  const [search, setSearch] = useState('');
  const [servico, setServico] = useState<'all' | ServicoAuditoria>('all');

  const rows = useMemo(
    () => registrosAuditoria.map(toAuditTableRow),
    [registrosAuditoria],
  );

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const blob = [
        r.utilizador,
        r.acaoLabel,
        r.alvo,
        r.resumo,
        r.entidadeId ?? '',
        r.origemIp ?? '',
        r.servico,
        r.data,
      ]
        .join(' ')
        .toLowerCase();
      const matchText = !q || blob.includes(q);
      const matchServico = servico === 'all' || r.servico === servico;
      return matchText && matchServico;
    });
  }, [rows, search, servico]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Auditoria</h1>
        <p className="text-gray-600 mt-1">
          Registo imutável de ações relevantes (quem, o quê, quando), alimentado pelo{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">service-audit</code> via RabbitMQ.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Utilizador, ação, alvo, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={servico} onValueChange={(v) => setServico(v as typeof servico)}>
              <SelectTrigger>
                <SelectValue placeholder="Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="audit">Audit</SelectItem>
                <SelectItem value="web">Web</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5" />
            Registos ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditEventsTable rows={filtrados} showServico showIp />
        </CardContent>
      </Card>
    </div>
  );
}

export function Auditoria() {
  return (
    <RequireRole roles={['ADMIN', 'MANAGER']}>
      <AuditoriaPage />
    </RequireRole>
  );
}
