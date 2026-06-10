import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/badge';
import { Check, X, Eye, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStoredAuthUser } from '../lib/apiBase';
import { Navigate } from 'react-router';
import { canApproveReservations } from '../lib/auth-roles';
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
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export function Aprovacoes() {
  if (!canApproveReservations()) {
    return <Navigate to="/" replace />;
  }

  const { reservas, aprovarReserva, rejeitarReserva } = useApp();
  const authUser = getStoredAuthUser();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReserva, setViewingReserva] = useState<any>(null);

  const pendentes = reservas.filter(r => r.status === 'pending');
  const processadas = reservas.filter(r => r.status !== 'pending');

  const handleAprovar = async (id: string) => {
    try {
      await aprovarReserva(id, authUser?.name ?? 'Gestor');
      toast.success('Reserva aprovada com sucesso!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aprovar');
    }
  };

  const handleRejeitar = (id: string) => {
    setRejectingId(id);
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (rejectingId === null) return;
    try {
      await rejeitarReserva(rejectingId, authUser?.name ?? 'Gestor', rejectMotivo);
      toast.success('Reserva rejeitada');
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectMotivo('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao rejeitar');
    }
  };

  const handleView = (reserva: any) => {
    setViewingReserva(reserva);
    setViewDialogOpen(true);
  };

  const formatData = (data: string) => {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Aprovações</h1>
          <p className="text-gray-600 mt-1">Gerencie solicitações de reservas</p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-gray-600">
            {pendentes.length} pendente(s)
          </span>
        </div>
      </div>

      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="processadas">
            Processadas ({processadas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardHeader>
              <CardTitle>Aguardando Aprovação</CardTitle>
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
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.map((reserva) => (
                      <TableRow key={reserva.id}>
                        <TableCell className="font-mono text-sm">#{reserva.id}</TableCell>
                        <TableCell className="font-medium">{reserva.recurso}</TableCell>
                        <TableCell>{reserva.solicitante}</TableCell>
                        <TableCell>{reserva.departamento}</TableCell>
                        <TableCell>{formatData(reserva.data)}</TableCell>
                        <TableCell>{reserva.horaInicio} - {reserva.horaFim}</TableCell>
                        <TableCell className="max-w-xs truncate">{reserva.motivo}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(reserva)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAprovar(reserva.id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRejeitar(reserva.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pendentes.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Nenhuma reserva pendente de aprovação
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processadas">
          <Card>
            <CardHeader>
              <CardTitle>Reservas Processadas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Aprovador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processadas.map((reserva) => (
                      <TableRow key={reserva.id}>
                        <TableCell className="font-mono text-sm">#{reserva.id}</TableCell>
                        <TableCell className="font-medium">{reserva.recurso}</TableCell>
                        <TableCell>{reserva.solicitante}</TableCell>
                        <TableCell>{formatData(reserva.data)}</TableCell>
                        <TableCell>{reserva.aprovador || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              reserva.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : reserva.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {reserva.status === 'approved' ? 'Aprovada' :
                             reserva.status === 'rejected' ? 'Rejeitada' :
                             'Cancelada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(reserva)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Reserva</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição da reserva
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da rejeição</Label>
            <Textarea
              id="motivo"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Ex: Conflito com manutenção agendada..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
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
                    <Badge
                      className={
                        viewingReserva.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : viewingReserva.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {viewingReserva.status === 'approved' ? 'Aprovada' :
                       viewingReserva.status === 'rejected' ? 'Rejeitada' :
                       'Pendente'}
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
    </div>
  );
}
