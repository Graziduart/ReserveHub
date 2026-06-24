import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/badge';
import { CalendarX2, Loader2 } from 'lucide-react';
import { Recurso, Reserva, Usuario } from '../../data/types';
import { useApp } from '../../context/AppContext';
import { getStoredAuthUser } from '../../lib/apiBase';
import { checkReservationAvailability } from '../../lib/api';
import { currentAuthRole } from '../../lib/auth-roles';
import { hasValidDepartment } from '../../lib/department-utils';
import { toast } from 'sonner';

type ReservaBloqueio = {
  recursoNome: string;
  pedido: string;
  conflitos: Array<{
    status: string;
    startDate: string;
    endDate: string;
    solicitante: string;
  }>;
  /** Aviso de prioridade departamental — permite submeter mesmo com conflitos pendentes inferiores. */
  avisoPrioridade?: string;
};

function formatIntervalo(isoStart: string, isoEnd: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${fmt(isoStart)} – ${fmt(isoEnd)}`;
}

function statusReservaLabel(status: string): string {
  if (status === 'APPROVED' || status === 'approved') return 'Aprovada';
  if (status === 'PENDING' || status === 'pending') return 'Pendente';
  return status;
}

interface ReservaModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (reserva: Omit<Reserva, 'id' | 'dataCriacao'>) => void;
  reserva?: Reserva;
}

function canBookResource(
  recurso: Pick<Recurso, 'departmentId' | 'disponivel'>,
  solicitante: Pick<Usuario, 'departmentId'> | null,
): boolean {
  if (!recurso.disponivel || !solicitante?.departmentId) return false;
  if (!recurso.departmentId) return true;
  return recurso.departmentId === solicitante.departmentId;
}

function resolveSolicitante(
  solicitanteId: string,
  usuarios: Usuario[],
  departamentos: { id: string; nome: string }[],
): Usuario | null {
  const fromList = usuarios.find((u) => u.id === solicitanteId);
  if (fromList) return fromList;

  const auth = getStoredAuthUser();
  if (auth?.id !== solicitanteId || !auth.departmentId) return null;

  const deptNome = departamentos.find((d) => d.id === auth.departmentId)?.nome?.trim();
  if (!deptNome) return null;

  return {
    id: auth.id,
    nome: auth.name,
    email: auth.email,
    departmentId: auth.departmentId,
    departamento: deptNome,
    cargo: 'Colaborador',
    perfil: 'colaborador',
    ativo: true,
  };
}

export function ReservaModal({ open, onClose, onSave, reserva }: ReservaModalProps) {
  const { recursos, usuarios, departamentos } = useApp();

  const [formData, setFormData] = useState({
    recursoId: '',
    solicitanteId: '',
    data: '',
    horaInicio: '',
    horaFim: '',
    motivo: '',
  });

  const [bloqueio, setBloqueio] = useState<ReservaBloqueio | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  useEffect(() => {
    if (reserva) {
      setFormData({
        recursoId: reserva.recursoId.toString(),
        solicitanteId: reserva.solicitanteId.toString(),
        data: reserva.data,
        horaInicio: reserva.horaInicio,
        horaFim: reserva.horaFim,
        motivo: reserva.motivo,
      });
    } else {
      const auth = getStoredAuthUser();
      setFormData({
        recursoId: '',
        solicitanteId: auth?.id ?? '',
        data: '',
        horaInicio: '',
        horaFim: '',
        motivo: '',
      });
    }
    setBloqueio(null);
    setCheckingConflict(false);
  }, [reserva, open]);

  const checkConflito = async (): Promise<boolean> => {
    if (!formData.recursoId || !formData.data || !formData.horaInicio || !formData.horaFim) {
      setBloqueio(null);
      return true;
    }
    const hi = formData.horaInicio.length === 5 ? `${formData.horaInicio}:00` : formData.horaInicio;
    const hf = formData.horaFim.length === 5 ? `${formData.horaFim}:00` : formData.horaFim;
    const startDate = new Date(`${formData.data}T${hi}`).toISOString();
    const endDate = new Date(`${formData.data}T${hf}`).toISOString();
    const recursoNome =
      recursos.find((r) => r.id === formData.recursoId)?.nome ?? 'Recurso selecionado';
    setCheckingConflict(true);
    try {
      const r = await checkReservationAvailability(
        formData.recursoId,
        startDate,
        endDate,
      );
      if (!r.available && !r.canOverridePending && r.conflicts && r.conflicts.length > 0) {
        setBloqueio({
          recursoNome,
          pedido: formatIntervalo(startDate, endDate),
          conflitos: r.conflicts,
        });
        return false;
      }
      if (r.canOverridePending && r.conflicts && r.conflicts.length > 0) {
        setBloqueio({
          recursoNome,
          pedido: formatIntervalo(startDate, endDate),
          conflitos: r.conflicts,
          avisoPrioridade:
            'Existem reservas pendentes de departamentos com menor prioridade. Ao confirmar, serão canceladas automaticamente.',
        });
        return true;
      }
      if (!r.available) {
        setBloqueio({
          recursoNome,
          pedido: formatIntervalo(startDate, endDate),
          conflitos: [],
        });
        return false;
      }
      setBloqueio(null);
      return true;
    } catch {
      setBloqueio(null);
      return true;
    } finally {
      setCheckingConflict(false);
    }
  };

  const authUser = getStoredAuthUser();
  const usuariosComDepartamento = usuarios.filter((u) => {
    if (!u.ativo || !hasValidDepartment(u)) return false;
    if (currentAuthRole() === 'MANAGER' && authUser?.departmentId) {
      return u.departmentId === authUser.departmentId;
    }
    return true;
  });

  const solicitanteAtual = (() => {
    const auth = getStoredAuthUser();
    const id =
      currentAuthRole() === 'EMPLOYEE'
        ? auth?.id ?? formData.solicitanteId
        : formData.solicitanteId;
    return resolveSolicitante(id, usuarios, departamentos);
  })();

  const recursosReservaveis = recursos.filter((r) =>
    currentAuthRole() === 'ADMIN'
      ? r.disponivel
      : canBookResource(r, solicitanteAtual),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const disponivel = await checkConflito();
    if (!disponivel) {
      toast.error('Horário indisponível — já existe reserva para este recurso.');
      return;
    }

    const recurso = recursosReservaveis.find((r) => r.id === formData.recursoId);
    const auth = getStoredAuthUser();
    const solicitanteId =
      currentAuthRole() === 'EMPLOYEE'
        ? auth?.id ?? formData.solicitanteId
        : formData.solicitanteId;
    const solicitante = resolveSolicitante(solicitanteId, usuarios, departamentos);

    if (!recurso) {
      toast.error('Selecione um recurso válido.');
      return;
    }
    if (!solicitante) {
      toast.error('Não foi possível identificar o solicitante. Tente entrar novamente.');
      return;
    }

    if (!hasValidDepartment(solicitante)) {
      toast.error(
        'O solicitante deve ter um departamento válido. Atualize o utilizador ou escolha outro.',
      );
      return;
    }

    const reservaData: Omit<Reserva, 'id' | 'dataCriacao'> = {
      recursoId: recurso.id,
      recurso: recurso.nome,
      solicitanteId: solicitante.id,
      solicitante: solicitante.nome,
      departamento: solicitante.departamento,
      data: formData.data,
      horaInicio: formData.horaInicio,
      horaFim: formData.horaFim,
      motivo: formData.motivo,
      status: 'pending',
    };

    onSave(reservaData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{reserva ? 'Editar Reserva' : 'Nova Reserva'}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para criar ou editar uma reserva de recurso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recurso">Recurso *</Label>
            <Select
              value={formData.recursoId}
              onValueChange={(value) => {
                setFormData({ ...formData, recursoId: value });
                checkConflito();
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um recurso" />
              </SelectTrigger>
              <SelectContent>
                {recursosReservaveis.map((recurso) => (
                  <SelectItem key={recurso.id} value={recurso.id}>
                    {recurso.nome} - {recurso.tipo}
                    {recurso.requiresApproval || currentAuthRole() === 'EMPLOYEE'
                      ? ' (requer aprovação)'
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recursosReservaveis.length === 0 && (
              <p className="text-sm text-amber-700">
                Nenhum recurso disponível para o seu departamento. Contacte o administrador.
              </p>
            )}
          </div>

          {currentAuthRole() !== 'EMPLOYEE' && (
            <div className="space-y-2">
              <Label htmlFor="solicitante">Solicitante *</Label>
              <Select
                value={formData.solicitanteId}
                onValueChange={(value) =>
                  setFormData({ ...formData, solicitanteId: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o solicitante" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosComDepartamento.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome} — {usuario.departamento}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usuariosComDepartamento.length === 0 && (
                <p className="text-sm text-amber-700">
                  Nenhum utilizador com departamento válido. Corrija os perfis em Utilizadores.
                </p>
              )}
            </div>
          )}

          {solicitanteAtual && (
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input
                value={
                  hasValidDepartment(solicitanteAtual)
                    ? solicitanteAtual.departamento
                    : ''
                }
                readOnly
                placeholder="Sem departamento — não é possível reservar"
                className={
                  hasValidDepartment(solicitanteAtual)
                    ? 'bg-gray-50'
                    : 'border-amber-300 bg-amber-50'
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="data">Data *</Label>
            <Input
              id="data"
              type="date"
              value={formData.data}
              onChange={(e) => {
                setFormData({ ...formData, data: e.target.value });
                void checkConflito();
              }}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horaInicio">Hora Início *</Label>
              <Input
                id="horaInicio"
                type="time"
                value={formData.horaInicio}
                onChange={(e) => {
                  setFormData({ ...formData, horaInicio: e.target.value });
                  checkConflito();
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horaFim">Hora Fim *</Label>
              <Input
                id="horaFim"
                type="time"
                value={formData.horaFim}
                onChange={(e) => {
                  setFormData({ ...formData, horaFim: e.target.value });
                  checkConflito();
                }}
                required
              />
            </div>
          </div>

          {checkingConflict && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="flex items-center gap-3 p-4 py-4">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
                <p className="text-sm text-blue-800">A verificar disponibilidade do recurso…</p>
              </CardContent>
            </Card>
          )}

          {bloqueio && !checkingConflict && (
            <Card
              className={
                bloqueio.avisoPrioridade
                  ? 'border-amber-300 bg-amber-50 shadow-sm overflow-hidden'
                  : 'border-red-300 bg-red-50 shadow-sm overflow-hidden'
              }
            >
              <CardContent className="p-0">
                <div
                  className={`flex gap-3 border-l-4 p-4 ${
                    bloqueio.avisoPrioridade ? 'border-amber-500' : 'border-red-500'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      bloqueio.avisoPrioridade ? 'bg-amber-100' : 'bg-red-100'
                    }`}
                  >
                    <CalendarX2
                      className={`h-5 w-5 ${
                        bloqueio.avisoPrioridade ? 'text-amber-600' : 'text-red-600'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p
                        className={`font-semibold ${
                          bloqueio.avisoPrioridade ? 'text-amber-900' : 'text-red-900'
                        }`}
                      >
                        {bloqueio.avisoPrioridade
                          ? 'Prioridade de departamento'
                          : 'Reserva bloqueada'}
                      </p>
                      <p
                        className={`mt-1 text-sm ${
                          bloqueio.avisoPrioridade ? 'text-amber-800' : 'text-red-800'
                        }`}
                      >
                        {bloqueio.avisoPrioridade ?? (
                          <>
                            O recurso <span className="font-medium">{bloqueio.recursoNome}</span>{' '}
                            já está ocupado no horário que escolheu ({bloqueio.pedido}). Alguém
                            reservou antes — escolha outro intervalo ou outro dia.
                          </>
                        )}
                      </p>
                    </div>

                    {bloqueio.conflitos.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-red-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                          Reserva existente
                        </p>
                        {bloqueio.conflitos.map((c, i) => (
                          <div
                            key={`${c.startDate}-${i}`}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <div className="text-gray-800">
                              <span className="font-medium">{c.solicitante}</span>
                              <span className="mx-1.5 text-gray-400">·</span>
                              <span className="text-gray-600">
                                {formatIntervalo(c.startDate, c.endDate)}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                c.status === 'APPROVED' || c.status === 'approved'
                                  ? 'border-green-300 bg-green-50 text-green-800'
                                  : 'border-amber-300 bg-amber-50 text-amber-800'
                              }
                            >
                              {statusReservaLabel(c.status)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Descreva o motivo da reserva..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                (!!bloqueio && !bloqueio.avisoPrioridade) ||
                checkingConflict ||
                !solicitanteAtual ||
                !hasValidDepartment(solicitanteAtual)
              }
            >
              {reserva ? 'Salvar Alterações' : 'Criar Reserva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
