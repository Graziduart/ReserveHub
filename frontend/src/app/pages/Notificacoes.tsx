import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Check, CheckCheck, ExternalLink, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { TipoNotificacao } from '../data/types';
import { cn } from '../lib/utils';

const tipoLabel: Record<TipoNotificacao, string> = {
  info: 'Informação',
  alerta: 'Alerta',
  sucesso: 'Sucesso',
  reserva: 'Reserva',
};

const tipoClass: Record<TipoNotificacao, string> = {
  info: 'bg-slate-100 text-slate-800',
  alerta: 'bg-amber-100 text-amber-900',
  sucesso: 'bg-emerald-100 text-emerald-900',
  reserva: 'bg-blue-100 text-blue-800',
};

export function Notificacoes() {
  const { notificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } = useApp();
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'lidas'>('todas');

  const naoLidas = useMemo(() => notificacoes.filter((n) => !n.lida).length, [notificacoes]);

  const filtradas = useMemo(() => {
    return notificacoes.filter((n) => {
      const q = search.toLowerCase();
      const matchText =
        n.titulo.toLowerCase().includes(q) || n.mensagem.toLowerCase().includes(q);
      const matchFiltro =
        filtro === 'todas' ||
        (filtro === 'nao_lidas' && !n.lida) ||
        (filtro === 'lidas' && n.lida);
      return matchText && matchFiltro;
    });
  }, [notificacoes, search, filtro]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notificações</h1>
          <p className="text-gray-600 mt-1">
            Alertas derivados da auditoria e das reservas — {naoLidas} não lida
            {naoLidas !== 1 ? 's' : ''}. Requer service-audit e dados carregados.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={naoLidas === 0}
          onClick={() => marcarTodasNotificacoesLidas()}
          className="shrink-0"
        >
          <CheckCheck className="w-4 h-4 mr-2" />
          Marcar todas como lidas
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por título ou mensagem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="nao_lidas">Não lidas</SelectItem>
                <SelectItem value="lidas">Lidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5" />
            Lista ({filtradas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtradas.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Nenhuma notificação encontrada.</p>
          ) : (
            filtradas.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex gap-4 p-4 rounded-lg border transition-colors',
                  n.lida ? 'border-gray-100 bg-gray-50/50' : 'border-blue-100 bg-blue-50/30'
                )}
              >
                <div className="flex-shrink-0 pt-0.5">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      n.lida ? 'bg-gray-200' : 'bg-blue-100'
                    )}
                  >
                    <Bell className={cn('w-5 h-5', n.lida ? 'text-gray-500' : 'text-blue-600')} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{n.titulo}</p>
                      <p className="text-sm text-gray-600 mt-1">{n.mensagem}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={tipoClass[n.tipo]}>{tipoLabel[n.tipo]}</Badge>
                      {!n.lida && (
                        <Badge variant="outline" className="border-blue-200 text-blue-700">
                          Nova
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>{n.data}</span>
                    {n.link && (
                      <Link
                        to={n.link}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                      >
                        Abrir módulo
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  {!n.lida && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-1"
                      onClick={() => marcarNotificacaoLida(n.id)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Marcar como lida
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
