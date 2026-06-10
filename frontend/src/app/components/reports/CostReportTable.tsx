import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table';
import { Badge } from '../ui/badge';
import type { CostReportRow } from '../../lib/cost-report';

type CostReportTableProps = {
  rows: CostReportRow[];
  loading?: boolean;
};

function CcBadge({ value }: { value: string }) {
  if (!value || value === '—') {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <Badge variant="outline" className="font-mono text-[11px] font-normal text-gray-700">
      {value}
    </Badge>
  );
}

export function CostReportTable({ rows, loading }: CostReportTableProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const departments = useMemo(
    () =>
      [...new Set(rows.map((r) => r.departamento))].sort((a, b) =>
        a.localeCompare(b, 'pt-PT'),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchDept = deptFilter === 'all' || r.departamento === deptFilter;
      if (!matchDept) return false;
      if (!q) return true;
      const blob = [
        r.departamento,
        r.sigla,
        r.centroCustoDept,
        r.centroCustoRecurso,
        r.recurso,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, deptFilter]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          aprovadas: acc.aprovadas + r.reservasAprovadas,
          pendentes: acc.pendentes + r.reservasPendentes,
          horas: acc.horas + r.horasReservadas,
        }),
        { aprovadas: 0, pendentes: 0, horas: 0 },
      ),
    [filtered],
  );

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        A consolidar dados do relatório…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-900 font-medium">Sem dados para apresentar</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          Não existem reservas activas (aprovadas ou pendentes) para gerar alocação de
          custos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar departamento, recurso ou centro de custo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead>Departamento</TableHead>
              <TableHead className="w-[72px]">Sigla</TableHead>
              <TableHead>CC departamento</TableHead>
              <TableHead>CC recurso</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead className="text-right w-[72px]">Aprov.</TableHead>
              <TableHead className="text-right w-[72px]">Pend.</TableHead>
              <TableHead className="text-right w-[88px]">Horas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-10">
                  Nenhuma linha corresponde aos filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filtered.map((r, i) => (
                  <TableRow
                    key={`${r.departamento}-${r.recurso}-${r.centroCustoRecurso}-${i}`}
                    className="hover:bg-slate-50/60"
                  >
                    <TableCell className="font-medium text-gray-900">{r.departamento}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {r.sigla}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CcBadge value={r.centroCustoDept} />
                    </TableCell>
                    <TableCell>
                      <CcBadge value={r.centroCustoRecurso} />
                    </TableCell>
                    <TableCell className="text-gray-700">{r.recurso}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700 font-medium">
                      {r.reservasAprovadas}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700 font-medium">
                      {r.reservasPendentes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-gray-900">
                      {r.horasReservadas.toFixed(1)}h
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100/80 hover:bg-slate-100/80 border-t-2 border-slate-200">
                  <TableCell colSpan={5} className="font-semibold text-gray-900">
                    Total
                    {deptFilter !== 'all' || search ? ` (${filtered.length} linhas)` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                    {totals.aprovadas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-amber-700">
                    {totals.pendentes}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-gray-900">
                    {totals.horas.toFixed(1)}h
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
