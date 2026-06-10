import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Plus, MapPin, Edit, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RecursoModal } from '../components/modals/RecursoModal';
import { Recurso } from '../data/types';
import { toast } from 'sonner';
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
import { canManageResources } from '../lib/auth-roles';

export function Recursos() {
  const { recursos, addRecurso, updateRecurso, deleteRecurso } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecurso, setEditingRecurso] = useState<Recurso | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const buscaGlobal = (searchParams.get('busca') ?? '').toLowerCase();
  const [filtroTipo, setFiltroTipo] = useState<string>('all');

  const handleAddRecurso = async (recursoData: Omit<Recurso, 'id'>) => {
    try {
      if (editingRecurso) {
        await updateRecurso(editingRecurso.id, recursoData);
        toast.success('Recurso atualizado com sucesso!');
      } else {
        await addRecurso(recursoData);
        toast.success('Recurso adicionado com sucesso!');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar recurso');
    }
    setEditingRecurso(undefined);
  };

  const handleEdit = (recurso: Recurso) => {
    setEditingRecurso(recurso);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingId === null) return;
    try {
      await deleteRecurso(deletingId);
      toast.success('Recurso excluído com sucesso!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desativar recurso');
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const recursosFiltrados = useMemo(() => {
    let list = filtroTipo === 'all' ? recursos : recursos.filter((r) => r.tipo === filtroTipo);
    if (buscaGlobal) {
      list = list.filter((r) =>
        [r.nome, r.tipo, r.localizacao, r.categoria, r.descricao]
          .join(' ')
          .toLowerCase()
          .includes(buscaGlobal),
      );
    }
    return list;
  }, [recursos, filtroTipo, buscaGlobal]);

  const tipos = ['all', ...Array.from(new Set(recursos.map(r => r.tipo)))];
  const manageResources = canManageResources();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recursos</h1>
          <p className="text-gray-600 mt-1">Gerencie todos os recursos disponíveis</p>
        </div>
        {manageResources && (
          <Button onClick={() => { setEditingRecurso(undefined); setModalOpen(true); }}>
            <Plus className="w-5 h-5 mr-2" />
            Novo Recurso
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {tipos.map((tipo) => (
          <Button
            key={tipo}
            variant={filtroTipo === tipo ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroTipo(tipo)}
          >
            {tipo === 'all' ? 'Todos' : tipo}
          </Button>
        ))}
      </div>

      {/* Grid de Recursos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recursosFiltrados.map((recurso) => (
          <Card key={recurso.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{recurso.nome}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{recurso.categoria}</p>
                </div>
                <Badge variant={recurso.disponivel ? 'default' : 'destructive'}>
                  {recurso.disponivel ? 'Disponível' : 'Indisponível'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recurso.capacidade && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Capacidade</span>
                  <span className="font-medium text-gray-900">{recurso.capacidade} pessoas</span>
                </div>
              )}

              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">{recurso.localizacao}</span>
              </div>

              {(recurso.departmentNome || recurso.costCenterCode) && (
                <div className="text-xs text-gray-600 space-y-0.5">
                  {recurso.departmentNome && (
                    <p>
                      Dept.: <span className="font-medium">{recurso.departmentNome}</span>
                    </p>
                  )}
                  {recurso.costCenterCode && (
                    <p>
                      CC:{' '}
                      <span className="font-mono font-medium">{recurso.costCenterCode}</span>
                    </p>
                  )}
                </div>
              )}

              {recurso.requiresApproval && (
                <Badge variant="outline" className="text-amber-800 border-amber-200">
                  Exige aprovação
                </Badge>
              )}

              <div className="space-y-1">
                <p className="text-sm text-gray-600 line-clamp-2">{recurso.descricao}</p>
              </div>

              {recurso.caracteristicas.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recurso.caracteristicas.slice(0, 3).map((car, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {car}
                    </span>
                  ))}
                  {recurso.caracteristicas.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                      +{recurso.caracteristicas.length - 3}
                    </span>
                  )}
                </div>
              )}

              {manageResources && (
                <div className="pt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(recurso)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(recurso.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {recursosFiltrados.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum recurso encontrado</p>
        </div>
      )}

      {/* Modal */}
      <RecursoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRecurso(undefined); }}
        onSave={handleAddRecurso}
        recurso={editingRecurso}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O recurso será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
