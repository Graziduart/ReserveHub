import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  Usuario,
  Departamento,
  Recurso,
  Reserva,
  Notificacao,
  RegistroAuditoria,
  UsuarioCreatePayload,
} from '../data/types';
import {
  approveReservation,
  cancelReservation,
  createDepartment,
  createResource,
  createReservation,
  createUser,
  deleteUser,
  disableDepartment,
  disableResource,
  listAuditEvents,
  listDepartments,
  listReservations,
  listResources,
  getCurrentUser,
  listUsers,
  mapAuditEvent,
  mapDepartment,
  mapReservation,
  mapResource,
  mapUser,
  rejectReservation,
  updateDepartment,
  updateResource,
  updateReservation,
  updateUser,
  type ApiAuditEvent,
} from '../lib/api';
import { formatApiError, getStoredAccessToken, getStoredAuthUser, RESERVEHUB_AUTH_EVENT } from '../lib/apiBase';
import { canViewAudit } from '../lib/auth-roles';
import {
  buildNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications';

interface AppContextType {
  loading: boolean;
  error: string | null;
  warnings: string[];
  refreshData: () => Promise<void>;

  usuarios: Usuario[];
  departamentos: Departamento[];
  recursos: Recurso[];
  reservas: Reserva[];
  notificacoes: Notificacao[];
  registrosAuditoria: RegistroAuditoria[];

  addRecurso: (recurso: Omit<Recurso, 'id'>) => Promise<void>;
  updateRecurso: (id: string, recurso: Partial<Recurso>) => Promise<void>;
  deleteRecurso: (id: string) => Promise<void>;

  addReserva: (reserva: Omit<Reserva, 'id' | 'dataCriacao'>) => Promise<void>;
  updateReserva: (id: string, reserva: Partial<Reserva>) => Promise<void>;
  deleteReserva: (id: string) => Promise<void>;
  aprovarReserva: (id: string, aprovador: string) => Promise<void>;
  rejeitarReserva: (id: string, aprovador: string, motivo?: string) => Promise<void>;

  addUsuario: (usuario: UsuarioCreatePayload) => Promise<void>;
  updateUsuario: (id: string, usuario: Partial<Usuario>) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;

  addDepartamento: (departamento: Omit<Departamento, 'id'>) => Promise<void>;
  updateDepartamento: (id: string, departamento: Partial<Departamento>) => Promise<void>;
  deleteDepartamento: (id: string) => Promise<void>;

  marcarNotificacaoLida: (id: string) => void;
  marcarTodasNotificacoesLidas: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function perfilToRole(p: Usuario['perfil']): 'ADMIN' | 'MANAGER' | 'EMPLOYEE' {
  if (p === 'administrador') return 'ADMIN';
  if (p === 'gestor') return 'MANAGER';
  return 'EMPLOYEE';
}

function toIsoRange(data: string, horaInicio: string, horaFim: string) {
  const hi = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio;
  const hf = horaFim.length === 5 ? `${horaFim}:00` : horaFim;
  const start = new Date(`${data}T${hi}`);
  const end = new Date(`${data}T${hf}`);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [registrosAuditoria, setRegistrosAuditoria] = useState<RegistroAuditoria[]>([]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const role = getStoredAuthUser()?.role;
      const usersPromise =
        role === 'ADMIN' || role === 'MANAGER'
          ? listUsers().catch(() => [] as Awaited<ReturnType<typeof listUsers>>)
          : role === 'EMPLOYEE'
            ? getCurrentUser()
                .then((u) => [u])
                .catch(() => {
                  const auth = getStoredAuthUser();
                  if (!auth?.departmentId) {
                    return [] as Awaited<ReturnType<typeof listUsers>>;
                  }
                  return [
                    {
                      id: auth.id,
                      name: auth.name,
                      email: auth.email,
                      role: auth.role as 'EMPLOYEE',
                      departmentId: auth.departmentId,
                      active: true,
                    },
                  ] as Awaited<ReturnType<typeof listUsers>>;
                })
            : Promise.resolve([] as Awaited<ReturnType<typeof listUsers>>);

      const [apiDeps, apiRes, apiResvs, apiUsers] = await Promise.all([
        listDepartments(),
        listResources(),
        listReservations(),
        usersPromise,
      ]);

      let apiAudit: ApiAuditEvent[] = [];
      const nextWarnings: string[] = [];
      if (canViewAudit()) {
        try {
          apiAudit = await listAuditEvents(100);
        } catch (e) {
          nextWarnings.push(
            formatApiError(e, 'service-audit') ||
              'Serviço de auditoria indisponível — histórico pode estar incompleto.',
          );
        }
      }
      setWarnings(nextWarnings);

      const deptCounts = new Map<string, number>();
      const gestorByDept = new Map<string, string>();
      for (const u of apiUsers) {
        deptCounts.set(u.departmentId, (deptCounts.get(u.departmentId) ?? 0) + 1);
        if (u.role === 'MANAGER' && !gestorByDept.has(u.departmentId)) {
          gestorByDept.set(u.departmentId, u.name);
        }
      }
      const deptNameById = new Map(apiDeps.map((d) => [d.id, d.name]));

      const mappedDeps = apiDeps.map((d) =>
        mapDepartment(d, deptCounts.get(d.id) ?? 0, gestorByDept.get(d.id) ?? '—'),
      );
      const mappedRecursos = apiRes.map(mapResource);
      const mappedUsuarios = apiUsers.map((u) => {
        const base = mapUser(u);
        const deptNome =
          u.department?.name?.trim() || deptNameById.get(u.departmentId)?.trim();
        return deptNome ? { ...base, departamento: deptNome } : base;
      });
      const deptByUserId = new Map(
        mappedUsuarios.map((u) => [u.id, u.departamento]),
      );
      const mappedReservas = apiResvs.map((r) => mapReservation(r, deptByUserId));
      const mappedAudit = apiAudit.map((ev, i) => mapAuditEvent(ev, i));

      setDepartamentos(mappedDeps);
      setRecursos(mappedRecursos);
      setUsuarios(mappedUsuarios);
      setReservas(mappedReservas);
      setRegistrosAuditoria(mappedAudit);
      setNotificacoes(buildNotifications(mappedAudit, mappedReservas));
    } catch (e) {
      setError(formatApiError(e, 'service-core'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = () => {
      if (!getStoredAccessToken()) {
        setDepartamentos([]);
        setRecursos([]);
        setUsuarios([]);
        setReservas([]);
        setRegistrosAuditoria([]);
        setNotificacoes([]);
        setLoading(false);
        setError(null);
        return;
      }
      void refreshData();
    };
    load();
    window.addEventListener(RESERVEHUB_AUTH_EVENT, load);
    return () => window.removeEventListener(RESERVEHUB_AUTH_EVENT, load);
  }, [refreshData]);

  const addRecurso = async (recurso: Omit<Recurso, 'id'>) => {
    await createResource({
      name: recurso.nome,
      type: recurso.tipo,
      location: recurso.localizacao,
      requiresApproval: recurso.requiresApproval ?? false,
      departmentId: recurso.departmentId,
      costCenterCode: recurso.costCenterCode,
      description: recurso.descricao || undefined,
      capacity: recurso.capacidade,
      category: recurso.categoria,
      characteristics: recurso.caracteristicas,
      active: recurso.disponivel,
    });
    await refreshData();
  };

  const updateRecursoFn = async (id: string, recurso: Partial<Recurso>) => {
    const current = recursos.find((r) => r.id === id);
    if (!current) return;
    await updateResource(id, {
      name: recurso.nome ?? current.nome,
      type: recurso.tipo ?? current.tipo,
      location: recurso.localizacao ?? current.localizacao,
      requiresApproval:
        recurso.requiresApproval ?? current.requiresApproval ?? false,
      departmentId: recurso.departmentId ?? current.departmentId,
      costCenterCode: recurso.costCenterCode ?? current.costCenterCode,
      description: recurso.descricao ?? current.descricao,
      capacity: recurso.capacidade ?? current.capacidade,
      category: recurso.categoria ?? current.categoria,
      characteristics: recurso.caracteristicas ?? current.caracteristicas,
      active: recurso.disponivel ?? current.disponivel,
    });
    await refreshData();
  };

  const deleteRecursoFn = async (id: string) => {
    await disableResource(id);
    await refreshData();
  };

  const addReserva = async (reserva: Omit<Reserva, 'id' | 'dataCriacao'>) => {
    const { startDate, endDate } = toIsoRange(
      reserva.data,
      reserva.horaInicio,
      reserva.horaFim,
    );
    const auth = getStoredAuthUser();
    await createReservation({
      userId:
        auth?.role === 'ADMIN' || auth?.role === 'MANAGER'
          ? reserva.solicitanteId
          : undefined,
      resourceId: reserva.recursoId,
      startDate,
      endDate,
      notes: reserva.motivo || undefined,
    });
    await refreshData();
  };

  const updateReservaFn = async (id: string, patch: Partial<Reserva>) => {
    const cur = reservas.find((r) => r.id === id);
    if (!cur) return;
    const data = patch.data ?? cur.data;
    const hi = patch.horaInicio ?? cur.horaInicio;
    const hf = patch.horaFim ?? cur.horaFim;
    const { startDate, endDate } = toIsoRange(data, hi, hf);
    await updateReservation(id, {
      startDate,
      endDate,
      notes: patch.motivo ?? cur.motivo,
    });
    await refreshData();
  };

  const deleteReservaFn = async (id: string) => {
    await cancelReservation(id);
    await refreshData();
  };

  const aprovarReserva = async (id: string, _aprovador: string) => {
    await approveReservation(id);
    await refreshData();
  };

  const rejeitarReserva = async (id: string, _aprovador: string, motivo?: string) => {
    await rejectReservation(id, motivo ?? 'Rejeitado');
    await refreshData();
  };

  const addUsuario = async (usuario: UsuarioCreatePayload) => {
    const pwd = usuario.password;
    if (!pwd || pwd.length < 8) {
      throw new Error('Password deve ter pelo menos 8 caracteres');
    }
    await createUser({
      name: usuario.nome,
      email: usuario.email,
      password: pwd,
      role: perfilToRole(usuario.perfil),
      departmentId: usuario.departmentId,
    });
    await refreshData();
  };

  const updateUsuarioFn = async (id: string, usuario: Partial<Usuario>) => {
    const body: Parameters<typeof updateUser>[1] = {};
    if (usuario.nome !== undefined) body.name = usuario.nome;
    if (usuario.email !== undefined) body.email = usuario.email;
    if (usuario.perfil !== undefined) body.role = perfilToRole(usuario.perfil);
    if (usuario.departmentId !== undefined) body.departmentId = usuario.departmentId;
    if (usuario.ativo !== undefined) body.active = usuario.ativo;
    if (Object.keys(body).length === 0) return;
    await updateUser(id, body);
    await refreshData();
  };

  const deleteUsuarioFn = async (id: string) => {
    await deleteUser(id);
    await refreshData();
  };

  const addDepartamento = async (departamento: Omit<Departamento, 'id'>) => {
    await createDepartment({
      name: departamento.nome,
      sigla: departamento.sigla,
      priority: departamento.priority,
      costCenterCode: departamento.costCenterCode,
    });
    await refreshData();
  };

  const updateDepartamentoFn = async (
    id: string,
    departamento: Partial<Departamento>,
  ) => {
    const cur = departamentos.find((d) => d.id === id);
    if (!cur) return;
    await updateDepartment(id, {
      name: departamento.nome ?? cur.nome,
      sigla: departamento.sigla ?? cur.sigla,
      priority: departamento.priority ?? cur.priority,
      costCenterCode: departamento.costCenterCode ?? cur.costCenterCode,
    });
    await refreshData();
  };

  const deleteDepartamentoFn = async (id: string) => {
    await disableDepartment(id);
    await refreshData();
  };

  const marcarNotificacaoLida = (id: string) => {
    markNotificationRead(id);
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
  };

  const marcarTodasNotificacoesLidas = () => {
    const ids = notificacoes.map((n) => n.id);
    markAllNotificationsRead(ids);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  return (
    <AppContext.Provider
      value={{
        loading,
        error,
        warnings,
        refreshData,
        usuarios,
        departamentos,
        recursos,
        reservas,
        notificacoes,
        registrosAuditoria,
        addRecurso,
        updateRecurso: updateRecursoFn,
        deleteRecurso: deleteRecursoFn,
        addReserva,
        updateReserva: updateReservaFn,
        deleteReserva: deleteReservaFn,
        aprovarReserva,
        rejeitarReserva,
        addUsuario,
        updateUsuario: updateUsuarioFn,
        deleteUsuario: deleteUsuarioFn,
        addDepartamento,
        updateDepartamento: updateDepartamentoFn,
        deleteDepartamento: deleteDepartamentoFn,
        marcarNotificacaoLida,
        marcarTodasNotificacoesLidas,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
