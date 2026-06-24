/** Tipos alinhados à API (UUIDs em string). */

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  departamento: string;
  /** ID do departamento na API (core) */
  departmentId: string;
  cargo: string;
  perfil: 'administrador' | 'gestor' | 'colaborador';
  ativo: boolean;
  avatar?: string;
}

export interface Departamento {
  id: string;
  nome: string;
  sigla: string;
  gestor: string;
  totalColaboradores: number;
  ativo: boolean;
  /** Prioridade de governança (0–100). */
  priority?: number;
  costCenterCode?: string;
}

export interface Recurso {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  capacidade?: number;
  localizacao: string;
  descricao: string;
  disponivel: boolean;
  caracteristicas: string[];
  imagemUrl?: string;
  /** Quando o recurso exige aprovação de reserva (API). */
  requiresApproval?: boolean;
  departmentId?: string;
  departmentNome?: string;
  costCenterCode?: string;
}

export type StatusReserva = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Reserva {
  id: string;
  recursoId: string;
  recurso: string;
  solicitanteId: string;
  solicitante: string;
  departamento: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  motivo: string;
  status: StatusReserva;
  observacoes?: string;
  aprovadorId?: string;
  aprovador?: string;
  dataAprovacao?: string;
  dataCriacao: string;
}

export interface LogAtividade {
  id: string;
  tipo:
    | 'reserva_criada'
    | 'reserva_aprovada'
    | 'reserva_rejeitada'
    | 'reserva_cancelada'
    | 'recurso_criado'
    | 'usuario_criado';
  descricao: string;
  usuario: string;
  data: string;
  detalhes?: string;
}

export type TipoNotificacao = 'info' | 'alerta' | 'sucesso' | 'reserva';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: TipoNotificacao;
  lida: boolean;
  data: string;
  link?: string;
}

export type ServicoAuditoria = 'core' | 'data' | 'audit' | 'web';

export interface RegistroAuditoria {
  id: string;
  data: string;
  utilizador: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhes: string;
  /** JSON completo do payload (para modal de detalhes). */
  payloadCompleto?: string;
  origemIp?: string;
  servico: ServicoAuditoria;
}

/** Payload ao criar utilizador (password só no create). */
export type UsuarioCreatePayload = Omit<Usuario, 'id'> & { password?: string };
