import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table';
import type { AuditTableRow } from '../../lib/audit-display';
import type { ServicoAuditoria } from '../../data/types';

const tipoLabels: Record<string, string> = {
  reserva_criada: 'Reserva',
  reserva_aprovada: 'Aprovação',
  reserva_rejeitada: 'Rejeição',
  reserva_cancelada: 'Cancelamento',
  recurso_criado: 'Recurso',
  departamento: 'Departamento',
  auditoria: 'Outros',
};

const tipoColors: Record<string, string> = {
  reserva_criada: 'bg-blue-100 text-blue-800',
  reserva_aprovada: 'bg-green-100 text-green-800',
  reserva_rejeitada: 'bg-red-100 text-red-800',
  reserva_cancelada: 'bg-gray-100 text-gray-800',
  recurso_criado: 'bg-purple-100 text-purple-800',
  departamento: 'bg-indigo-100 text-indigo-800',
  auditoria: 'bg-slate-100 text-slate-800',
};

const servicoLabel: Record<ServicoAuditoria, string> = {
  core: 'Core',
  data: 'Data',
  audit: 'Audit',
  web: 'Web',
};

const servicoClass: Record<ServicoAuditoria, string> = {
  core: 'bg-violet-100 text-violet-800',
  data: 'bg-cyan-100 text-cyan-800',
  audit: 'bg-orange-100 text-orange-900',
  web: 'bg-gray-100 text-gray-800',
};

type AuditEventsTableProps = {
  rows: AuditTableRow[];
  showServico?: boolean;
  showIp?: boolean;
  emptyMessage?: string;
};

export function AuditEventsTable({
  rows,
  showServico = false,
  showIp = false,
  emptyMessage = 'Nenhum registo encontrado.',
}: AuditEventsTableProps) {
  const [detailRow, setDetailRow] = useState<AuditTableRow | null>(null);

  const colSpan = 6 + (showServico ? 1 : 0) + (showIp ? 1 : 0);

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Data / hora</TableHead>
              <TableHead>Utilizador</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead>Detalhes</TableHead>
              {showServico ? <TableHead>Serviço</TableHead> : null}
              {showIp ? <TableHead className="whitespace-nowrap">IP</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-gray-500 py-10">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-sm font-mono text-gray-700">
                    {row.data}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px]">
                    <span className="font-medium text-gray-900 block truncate" title={row.utilizador}>
                      {row.utilizador}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-gray-900 max-w-[180px]">
                    {row.acaoLabel}
                  </TableCell>
                  <TableCell>
                    <Badge className={tipoColors[row.tipo] ?? tipoColors.auditoria}>
                      {tipoLabels[row.tipo] ?? row.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[220px]">
                    <span className="block truncate" title={row.alvo}>
                      {row.alvo}
                    </span>
                    {row.entidadeId ? (
                      <span className="text-xs text-gray-500 font-mono truncate block" title={row.entidadeId}>
                        {row.entidadeId}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-xs">
                    <p className="line-clamp-2" title={row.resumo}>
                      {row.resumo}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => setDetailRow(row)}
                    >
                      Ver payload
                    </Button>
                  </TableCell>
                  {showServico ? (
                    <TableCell>
                      <Badge className={servicoClass[row.servico]}>{servicoLabel[row.servico]}</Badge>
                    </TableCell>
                  ) : null}
                  {showIp ? (
                    <TableCell className="text-sm font-mono text-gray-500 whitespace-nowrap">
                      {row.origemIp ?? '—'}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(detailRow)} onOpenChange={() => setDetailRow(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{detailRow?.acaoLabel ?? 'Detalhes do evento'}</DialogTitle>
            <DialogDescription>
              {detailRow?.utilizador} · {detailRow?.data}
            </DialogDescription>
          </DialogHeader>
          <pre className="text-xs bg-gray-50 border rounded-md p-4 overflow-auto font-mono whitespace-pre-wrap break-all">
            {detailRow?.payloadCompleto}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
