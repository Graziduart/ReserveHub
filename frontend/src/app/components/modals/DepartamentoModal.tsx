import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Label } from '../ui/label';
import type { Departamento } from '../../data/types';
import {
  isDepartmentNameTaken,
  normalizeDepartmentName,
} from '../../lib/department-utils';

interface DepartamentoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    dept: Omit<Departamento, 'id' | 'gestor' | 'totalFuncionarios'>,
  ) => Promise<void>;
  departamento?: Departamento;
  departamentos: Pick<Departamento, 'id' | 'nome'>[];
}

export function DepartamentoModal({
  open,
  onClose,
  onSave,
  departamento,
  departamentos,
}: DepartamentoModalProps) {
  const [nome, setNome] = useState('');
  const [sigla, setSigla] = useState('');
  const [priority, setPriority] = useState('50');
  const [costCenterCode, setCostCenterCode] = useState('');
  const [nomeError, setNomeError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (departamento) {
      setNome(departamento.nome);
      setSigla(departamento.sigla);
      setPriority(String(departamento.priority ?? 50));
      setCostCenterCode(departamento.costCenterCode ?? '');
    } else {
      setNome('');
      setSigla('');
      setPriority('50');
      setCostCenterCode('');
    }
    setNomeError('');
  }, [departamento, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNome = normalizeDepartmentName(nome);
    if (isDepartmentNameTaken(trimmedNome, departamentos, departamento?.id)) {
      setNomeError('Já existe um departamento com este nome.');
      return;
    }
    setNomeError('');
    setSaving(true);
    try {
      await onSave({
        nome: trimmedNome,
        sigla: sigla.trim().toUpperCase(),
        priority: Math.min(100, Math.max(0, Number(priority) || 0)),
        costCenterCode: costCenterCode.trim() || undefined,
        ativo: departamento?.ativo ?? true,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {departamento ? 'Editar departamento' : 'Novo departamento'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para criar ou editar um departamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-nome">Nome *</Label>
            <Input
              id="dept-nome"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (nomeError) setNomeError('');
              }}
              required
              aria-invalid={Boolean(nomeError)}
            />
            {nomeError ? (
              <p className="text-sm text-red-600">{nomeError}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dept-sigla">Sigla *</Label>
              <Input
                id="dept-sigla"
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                maxLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-priority">Prioridade (0–100)</Label>
              <Input
                id="dept-priority"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-cc">Centro de custo</Label>
            <Input
              id="dept-cc"
              value={costCenterCode}
              onChange={(e) => setCostCenterCode(e.target.value)}
              placeholder="Ex: CC-RH-001"
            />
          </div>
          <p className="text-xs text-gray-500">
            Maior prioridade resolve conflitos com reservas pendentes de outros departamentos.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {departamento ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
