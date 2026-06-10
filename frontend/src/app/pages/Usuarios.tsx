import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UsuarioModal } from '../components/modals/UsuarioModal';
import { Usuario, UsuarioCreatePayload } from '../data/types';
import { toast } from 'sonner';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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

function UsuariosPage() {
  const { usuarios, addUsuario, updateUsuario, deleteUsuario, departamentos } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const q = searchParams.get('busca');
    if (q) setSearchTerm(q);
  }, [searchParams]);
  const [filtroDepartamento, setFiltroDepartamento] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');

  const handleAddUsuario = async (usuarioData: UsuarioCreatePayload) => {
    try {
      if (editingUsuario) {
        await updateUsuario(editingUsuario.id, usuarioData);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        await addUsuario(usuarioData);
        toast.success('Usuário adicionado com sucesso!');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar utilizador');
    }
    setEditingUsuario(undefined);
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingId === null) return;
    try {
      await deleteUsuario(deletingId);
      toast.success('Usuário excluído com sucesso!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao eliminar utilizador');
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const getInitials = (nome: string) => {
    return nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    const matchSearch = usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = filtroDepartamento === 'all' || usuario.departamento === filtroDepartamento;
    const matchStatus = filtroStatus === 'all' ||
                        (filtroStatus === 'ativo' && usuario.ativo) ||
                        (filtroStatus === 'inativo' && !usuario.ativo);
    return matchSearch && matchDept && matchStatus;
  });

  const perfilColors: Record<Usuario['perfil'], string> = {
    administrador: 'bg-red-100 text-red-800',
    gestor: 'bg-blue-100 text-blue-800',
    funcionario: 'bg-gray-100 text-gray-800',
  };

  const perfilLabels: Record<Usuario['perfil'], string> = {
    administrador: 'Admin',
    gestor: 'Gestor',
    funcionario: 'Funcionário',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Usuários</h1>
          <p className="text-gray-600 mt-1">Gerencie os usuários do sistema</p>
        </div>
        <Button onClick={() => { setEditingUsuario(undefined); setModalOpen(true); }}>
          <Plus className="w-5 h-5 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                {departamentos.map(dept => (
                  <SelectItem key={dept.id} value={dept.nome}>
                    {dept.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Todos os Usuários ({usuariosFiltrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosFiltrados.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-blue-600 text-white">
                            {getInitials(usuario.nome)}
                          </AvatarFallback>
                        </Avatar>
                        {usuario.nome}
                      </div>
                    </TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>{usuario.departamento}</TableCell>
                    <TableCell>{usuario.cargo}</TableCell>
                    <TableCell>
                      <Badge className={perfilColors[usuario.perfil]}>
                        {perfilLabels[usuario.perfil]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                        {usuario.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(usuario)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(usuario.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {usuariosFiltrados.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum usuário encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <UsuarioModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingUsuario(undefined); }}
        onSave={handleAddUsuario}
        usuario={editingUsuario}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário será permanentemente excluído do sistema.
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

export function Usuarios() {
  return (
    <RequireRole roles={['ADMIN']}>
      <UsuariosPage />
    </RequireRole>
  );
}
