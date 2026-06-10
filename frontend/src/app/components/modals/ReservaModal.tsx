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
import { Reserva } from '../../data/types';
import { useApp } from '../../context/AppContext';
import { getStoredAuthUser } from '../../lib/apiBase';
import { checkReservationAvailability } from '../../lib/api';
import { currentAuthRole } from '../../lib/auth-roles';
import { hasValidDepartment } from '../../lib/department-utils';
import { toast } from 'sonner';

interface ReservaModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (reserva: Omit<Reserva, 'id' | 'dataCriacao'>) => void;
  reserva?: Reserva;
}

export function ReservaModal({ open, onClose, onSave, reserva }: ReservaModalProps) {
  const { recursos, usuarios } = useApp();

  const [formData, setFormData] = useState({
    recursoId: '',
    solicitanteId: '',
    data: '',
    horaInicio: '',
    horaFim: '',
    motivo: '',
  });

  const [conflito, setConflito] = useState<string | null>(null);
  const [canOverridePending, setCanOverridePending] = useState(false);

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
    setConflito(null);
    setCanOverridePending(false);
  }, [reserva, open]);

  const checkConflito = async () => {
    if (!formData.recursoId || !formData.data || !formData.horaInicio || !formData.horaFim) {
      setConflito(null);
      setCanOverridePending(false);
      return;
    }
    const hi = formData.horaInicio.length === 5 ? `${formData.horaInicio}:00` : formData.horaInicio;
    const hf = formData.horaFim.length === 5 ? `${formData.horaFim}:00` : formData.horaFim;
    const startDate = new Date(`${formData.data}T${hi}`).toISOString();
    const endDate = new Date(`${formData.data}T${hf}`).toISOString();
    try {
      const r = await checkReservationAvailability(
        formData.recursoId,
        startDate,
        endDate,
      );
      if (!r.available) {
        setCanOverridePending(!!r.canOverridePending);
        setConflito(
          r.canOverridePending
            ? 'Existe conflito, mas o seu departamento pode substituir reservas pendentes de menor prioridade.'
            : 'Horário indisponível para este recurso.',
        );
      } else {
        setConflito(null);
        setCanOverridePending(false);
      }
    } catch {
      setConflito(null);
      setCanOverridePending(false);
    }
  };

  const usuariosComDepartamento = usuarios.filter(
    (u) => u.ativo && hasValidDepartment(u),
  );

  const solicitanteAtual = (() => {
    const auth = getStoredAuthUser();
    const id =
      currentAuthRole() === 'EMPLOYEE'
        ? auth?.id ?? formData.solicitanteId
        : formData.solicitanteId;
    return usuarios.find((u) => u.id === id);
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const recurso = recursos.find((r) => r.id === formData.recursoId);
    const auth = getStoredAuthUser();
    const solicitanteId =
      currentAuthRole() === 'EMPLOYEE'
        ? auth?.id ?? formData.solicitanteId
        : formData.solicitanteId;
    const solicitante = usuarios.find((u) => u.id === solicitanteId);

    if (!recurso || !solicitante) return;

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
                {recursos.filter((r) => r.disponivel).map((recurso) => (
                  <SelectItem key={recurso.id} value={recurso.id}>
                    {recurso.nome} - {recurso.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {conflito && (
            <div
              className={`p-3 border rounded-lg text-sm ${
                canOverridePending
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {conflito}
            </div>
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
                (!!conflito && !canOverridePending) ||
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
