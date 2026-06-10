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
import { Recurso } from '../../data/types';
import { useApp } from '../../context/AppContext';

interface RecursoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (recurso: Omit<Recurso, 'id'>) => void;
  recurso?: Recurso;
}

export function RecursoModal({ open, onClose, onSave, recurso }: RecursoModalProps) {
  const { departamentos } = useApp();
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'Sala' as Recurso['tipo'],
    categoria: '',
    capacidade: '',
    localizacao: '',
    descricao: '',
    disponivel: true,
    caracteristicas: '',
    requiresApproval: false,
    departmentId: '',
    costCenterCode: '',
  });

  useEffect(() => {
    if (recurso) {
      setFormData({
        nome: recurso.nome,
        tipo: recurso.tipo,
        categoria: recurso.categoria,
        capacidade: recurso.capacidade?.toString() || '',
        localizacao: recurso.localizacao,
        descricao: recurso.descricao,
        disponivel: recurso.disponivel,
        caracteristicas: recurso.caracteristicas.join(', '),
        requiresApproval: recurso.requiresApproval ?? false,
        departmentId: recurso.departmentId ?? '',
        costCenterCode: recurso.costCenterCode ?? '',
      });
    } else {
      setFormData({
        nome: '',
        tipo: 'Sala',
        categoria: '',
        capacidade: '',
        localizacao: '',
        descricao: '',
        disponivel: true,
        caracteristicas: '',
        requiresApproval: false,
        departmentId: departamentos[0]?.id ?? '',
        costCenterCode: '',
      });
    }
  }, [recurso, open, departamentos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const recursoData: Omit<Recurso, 'id'> = {
      nome: formData.nome,
      tipo: formData.tipo,
      categoria: formData.categoria,
      capacidade: formData.capacidade ? parseInt(formData.capacidade) : undefined,
      localizacao: formData.localizacao,
      descricao: formData.descricao,
      disponivel: formData.disponivel,
      caracteristicas: formData.caracteristicas.split(',').map(c => c.trim()).filter(c => c),
      requiresApproval: formData.requiresApproval,
      departmentId: formData.departmentId || undefined,
      costCenterCode: formData.costCenterCode.trim() || undefined,
    };

    onSave(recursoData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{recurso ? 'Editar Recurso' : 'Novo Recurso'}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para criar ou editar um recurso reservável.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value as Recurso['tipo'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sala">Sala</SelectItem>
                  <SelectItem value="Equipamento">Equipamento</SelectItem>
                  <SelectItem value="Veiculo">Veículo</SelectItem>
                  <SelectItem value="Laboratorio">Laboratório</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Input
                id="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidade">Capacidade</Label>
              <Input
                id="capacidade"
                type="number"
                value={formData.capacidade}
                onChange={(e) => setFormData({ ...formData, capacidade: e.target.value })}
                placeholder="Ex: 8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={formData.departmentId || '_none'}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    departmentId: v === '_none' ? '' : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Nenhum —</SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.sigla} — {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="costCenterCode">Centro de custo</Label>
              <Input
                id="costCenterCode"
                value={formData.costCenterCode}
                onChange={(e) =>
                  setFormData({ ...formData, costCenterCode: e.target.value })
                }
                placeholder="Ex: CC-SALAS-01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="localizacao">Localização *</Label>
            <Input
              id="localizacao"
              value={formData.localizacao}
              onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
              placeholder="Ex: 2º Andar - Ala Norte"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o recurso..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caracteristicas">Características</Label>
            <Input
              id="caracteristicas"
              value={formData.caracteristicas}
              onChange={(e) => setFormData({ ...formData, caracteristicas: e.target.value })}
              placeholder="Separe por vírgula: WiFi, Ar condicionado, TV"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="disponivel"
                checked={formData.disponivel}
                onChange={(e) => setFormData({ ...formData, disponivel: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Label htmlFor="disponivel">Recurso disponível</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requiresApproval"
                checked={formData.requiresApproval}
                onChange={(e) =>
                  setFormData({ ...formData, requiresApproval: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Label htmlFor="requiresApproval">Exige aprovação de reserva</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {recurso ? 'Salvar Alterações' : 'Adicionar Recurso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
