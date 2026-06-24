import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Plus, Users, Edit, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DepartamentoModal } from '../components/modals/DepartamentoModal';
import type { Departamento } from '../data/types';
import { toast } from 'sonner';
import { formatApiError } from '../lib/apiBase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { RequireRole } from '../components/auth/RequireRole';

function DepartamentosPage() {
  const {
    departamentos,
    usuarios,
    addDepartamento,
    updateDepartamento,
    deleteDepartamento,
  } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Departamento | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleSave = async (
    data: Omit<Departamento, 'id' | 'gestor' | 'totalColaboradores'>,
  ) => {
    try {
      if (editing) {
        await updateDepartamento(editing.id, data);
        toast.success('Departamento atualizado');
      } else {
        await addDepartamento({
          ...data,
          gestor: '—',
          totalColaboradores: 0,
        });
        toast.success('Departamento criado');
      }
    } catch (e) {
      toast.error(formatApiError(e, 'servidor core'));
      throw e;
    }
    setEditing(undefined);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDepartamento(deleteId);
      toast.success('Departamento desativado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desativar');
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Departamentos</h1>
          <p className="text-gray-600 mt-1">
            Prioridade e centro de custo para governança de reservas
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Departamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departamentos.map((dept) => {
          const colaboradores = usuarios.filter(
            (u) => u.departmentId === dept.id || u.departamento === dept.nome,
          );
          const colaboradoresAtivos = colaboradores.filter((u) => u.ativo).length;

          return (
            <Card key={dept.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{dept.nome}</CardTitle>
                    <Badge variant="outline" className="mt-2">
                      {dept.sigla}
                    </Badge>
                  </div>
                  <Badge variant={dept.ativo ? 'default' : 'secondary'}>
                    {dept.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-600">Prioridade</p>
                    <p className="font-semibold">{dept.priority ?? 50}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Centro de custo</p>
                    <p className="font-mono text-xs font-semibold">
                      {dept.costCenterCode ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Colaboradores</p>
                    <p className="font-semibold text-gray-900">
                      {colaboradoresAtivos} ativos de {colaboradores.length}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Gestor</p>
                  <p className="font-medium text-gray-900">{dept.gestor}</p>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setEditing(dept);
                      setModalOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(dept.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visão Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{departamentos.length}</p>
              <p className="text-sm text-gray-600 mt-1">Total de Departamentos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {usuarios.filter((u) => u.ativo).length}
              </p>
              <p className="text-sm text-gray-600 mt-1">Colaboradores Ativos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                {departamentos.length === 0
                  ? 0
                  : Math.round(
                      usuarios.filter((u) => u.ativo).length / departamentos.length,
                    )}
              </p>
              <p className="text-sm text-gray-600 mt-1">Média por Departamento</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DepartamentoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSave={handleSave}
        departamento={editing}
        departamentos={departamentos}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O departamento deixará de estar disponível para novos vínculos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function Departamentos() {
  return (
    <RequireRole roles={['ADMIN']}>
      <DepartamentosPage />
    </RequireRole>
  );
}
