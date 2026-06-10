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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Usuario, UsuarioCreatePayload } from '../../data/types';
import { useApp } from '../../context/AppContext';

interface UsuarioModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (usuario: UsuarioCreatePayload) => void;
  usuario?: Usuario;
}

export function UsuarioModal({ open, onClose, onSave, usuario }: UsuarioModalProps) {
  const { departamentos } = useApp();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    departmentId: '',
    cargo: '',
    perfil: 'funcionario' as Usuario['perfil'],
    ativo: true,
    password: '',
  });

  useEffect(() => {
    if (usuario) {
      setFormData({
        nome: usuario.nome,
        email: usuario.email,
        departmentId: usuario.departmentId,
        cargo: usuario.cargo,
        perfil: usuario.perfil,
        ativo: usuario.ativo,
        password: '',
      });
    } else {
      setFormData({
        nome: '',
        email: '',
        departmentId: '',
        cargo: '',
        perfil: 'funcionario',
        ativo: true,
        password: '',
      });
    }
  }, [usuario, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dept = departamentos.find((d) => d.id === formData.departmentId);
    const payload: UsuarioCreatePayload = {
      nome: formData.nome,
      email: formData.email,
      departamento: dept?.nome ?? '',
      departmentId: formData.departmentId,
      cargo: formData.cargo,
      perfil: formData.perfil,
      ativo: formData.ativo,
      ...(!usuario && formData.password ? { password: formData.password } : {}),
    };
    onSave(payload);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{usuario ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para criar ou editar um usuário do sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: João Silva Santos"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="joao.santos@empresa.com"
              required
            />
          </div>

          {!usuario && (
            <div className="space-y-2">
              <Label htmlFor="password">Password * (mín. 8 caracteres)</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Password inicial"
                required
                minLength={8}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Departamento *</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo *</Label>
              <Input
                id="cargo"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Analista"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perfil">Perfil de Acesso *</Label>
            <Select
              value={formData.perfil}
              onValueChange={(value) =>
                setFormData({ ...formData, perfil: value as Usuario['perfil'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="funcionario">Funcionário</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="administrador">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <Label htmlFor="ativo">Usuário ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{usuario ? 'Salvar Alterações' : 'Adicionar Usuário'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
