import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/badge';
import { Plus, Eye, Edit, Trash2, Filter } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ReservaModal } from '../components/modals/ReservaModal';
import { Reserva, StatusReserva } from '../data/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const statusLabels: Record<StatusReserva, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
};

const statusColors: Record<StatusReserva, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export function Reservas() {
  const { reservas, addReserva, updateReserva, deleteReserva } = useApp();
  const [searchParams] = useSearchParams();
  const buscaGlobal = (searchParams.get('busca') ?? '').toLowerCase();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState<Reserva | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReserva, setViewingReserva] = useState<Reserva | null>(null);

  const handleAddReserva = async (reservaData: Omit<Reserva, 'id' | 'dataCriacao'>) => {
    try {
      if (editingReserva) {
        await updateReserva(editingReserva.id, reservaData);
        toast.success('Reserva atualizada com sucesso!');
      } else {
        await addReserva(reservaData);
        toast.success('Reserva criada com sucesso! Aguardando aprovação.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar reserva');
    }
    setEditingReserva(undefined);
  };

  const handleEdit = (reserva: Reserva) => {
    setEditingReserva(reserva);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingId === null) return;
    try {
      await deleteReserva(deletingId);
      toast.success('Reserva cancelada com sucesso!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar reserva');
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const formatData = (data: string) => {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const reservasFiltradas = useMemo(() => {
    let list = filtroStatus === 'all' ? reservas : reservas.filter((r) => r.status === filtroStatus);
    if (buscaGlobal) {
      list = list.filter((r) =>
        [r.recurso, r.solicitante, r.departamento, r.motivo, r.id]
          .join(' ')
          .toLowerCase()
          .includes(buscaGlobal),
      );
    }
    return list;
  }, [reservas, filtroStatus, buscaGlobal]);

  const handleView = (reserva: Reserva) => {
    setViewingReserva(reserva);
    setViewDialogOpen(true);
  };

  const reservasOrdenadas = [...reservasFiltradas].sort((a, b) => {
    const dataA = new Date(a.data + 'T' + a.horaInicio);
    const dataB = new Date(b.data + 'T' + b.horaInicio);
    return dataB.getTime() - dataA.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-gray-600 mt-1">Gerencie todas as reservas de recursos</p>
        </div>
        <Button onClick={() => { setEditingReserva(undefined); setModalOpen(true); }}>
          <Plus className="w-5 h-5 mr-2" />
          Nova Reserva
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600">
              {reservasOrdenadas.length} reserva(s) encontrada(s)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Reservas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservasOrdenadas.map((reserva) => (
                  <TableRow key={reserva.id}>
                    <TableCell className="font-mono text-sm">#{reserva.id}</TableCell>
                    <TableCell className="font-medium">{reserva.recurso}</TableCell>
                    <TableCell>{reserva.solicitante}</TableCell>
                    <TableCell>{reserva.departamento}</TableCell>
                    <TableCell>{formatData(reserva.data)}</TableCell>
                    <TableCell>{reserva.horaInicio} - {reserva.horaFim}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[reserva.status]}>
                        {statusLabels[reserva.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {reserva.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(reserva)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(reserva.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {reserva.status !== 'pending' && (
                          <Button variant="ghost" size="sm" onClick={() => handleView(reserva)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {reservasOrdenadas.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhuma reserva encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <ReservaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingReserva(undefined); }}
        onSave={handleAddReserva}
        reserva={editingReserva}
      />

      {viewingReserva && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Detalhes da Reserva</DialogTitle>
              <DialogDescription className="sr-only">
                Visualização dos detalhes da reserva selecionada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">ID</Label>
                  <p className="font-mono">#{viewingReserva.id}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Status</Label>
                  <div className="mt-1">
                    <Badge className={statusColors[viewingReserva.status]}>
                      {statusLabels[viewingReserva.status]}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Recurso</Label>
                <p className="font-medium">{viewingReserva.recurso}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Solicitante</Label>
                  <p>{viewingReserva.solicitante}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Departamento</Label>
                  <p>{viewingReserva.departamento}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Data</Label>
                  <p>{formatData(viewingReserva.data)}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Horário</Label>
                  <p>{viewingReserva.horaInicio} - {viewingReserva.horaFim}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Motivo</Label>
                <p className="text-sm">{viewingReserva.motivo}</p>
              </div>
              {viewingReserva.aprovador && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Aprovador</Label>
                    <p>{viewingReserva.aprovador}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Data da Aprovação</Label>
                    <p className="text-sm">{viewingReserva.dataAprovacao}</p>
                  </div>
                </div>
              )}
              {viewingReserva.observacoes && (
                <div>
                  <Label className="text-gray-600">Observações</Label>
                  <p className="text-sm text-red-600">{viewingReserva.observacoes}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setViewDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar a reserva. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Cancelar Reserva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
