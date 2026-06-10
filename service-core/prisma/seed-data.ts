import { Role } from '@prisma/client';

export type DemoReservationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/** Marcador em reservas criadas pelo seed (permite reexecutar). */
export const SEED_RESERVATION_NOTES = '[seed] reserva de demonstração';

export type DemoDepartment = {
  sigla: string;
  name: string;
  priority: number;
  costCenterCode: string;
};

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentSigla: string;
};

export type DemoResource = {
  key: string;
  name: string;
  type: string;
  location: string;
  requiresApproval: boolean;
  costCenterCode: string;
  departmentSigla: string;
};

export type DemoReservation = {
  key: string;
  userEmail: string;
  resourceKey: string;
  status: DemoReservationStatus;
  daysFromNow: number;
  startHour: number;
  endHour: number;
  notes?: string;
  rejectReason?: string;
  approverEmail?: string;
};

export const DEMO_DEPARTMENTS: DemoDepartment[] = [
  { sigla: 'ADM', name: 'Administração', priority: 100, costCenterCode: 'CC-ADM' },
  { sigla: 'RH', name: 'Recursos Humanos', priority: 80, costCenterCode: 'CC-RH' },
  { sigla: 'TI', name: 'Tecnologia da Informação', priority: 70, costCenterCode: 'CC-TI' },
  { sigla: 'FIN', name: 'Financeiro', priority: 60, costCenterCode: 'CC-FIN' },
  { sigla: 'COM', name: 'Comercial', priority: 50, costCenterCode: 'CC-COM' },
];

/** IDs fixos para sincronizar com service-iam. */
export const DEMO_USERS: DemoUser[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@reservehub.local',
    name: 'Administrador',
    role: Role.ADMIN,
    departmentSigla: 'ADM',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    email: 'gestor.rh@reservehub.local',
    name: 'Gestor RH',
    role: Role.MANAGER,
    departmentSigla: 'RH',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    email: 'gestor.ti@reservehub.local',
    name: 'Gestor TI',
    role: Role.MANAGER,
    departmentSigla: 'TI',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    email: 'ana.silva@reservehub.local',
    name: 'Ana Silva',
    role: Role.EMPLOYEE,
    departmentSigla: 'RH',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    email: 'bruno.costa@reservehub.local',
    name: 'Bruno Costa',
    role: Role.EMPLOYEE,
    departmentSigla: 'TI',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    email: 'carla.mendes@reservehub.local',
    name: 'Carla Mendes',
    role: Role.EMPLOYEE,
    departmentSigla: 'FIN',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000007',
    email: 'diego.santos@reservehub.local',
    name: 'Diego Santos',
    role: Role.EMPLOYEE,
    departmentSigla: 'COM',
  },
];

export const DEMO_RESOURCES: DemoResource[] = [
  {
    key: 'sala-executiva',
    name: 'Sala Executiva',
    type: 'Sala',
    location: '1º Andar — Ala Norte',
    requiresApproval: true,
    costCenterCode: 'CC-TI-SALAS',
    departmentSigla: 'TI',
  },
  {
    key: 'sala-rh',
    name: 'Sala de Formação RH',
    type: 'Sala',
    location: '2º Andar — RH',
    requiresApproval: false,
    costCenterCode: 'CC-RH-SALAS',
    departmentSigla: 'RH',
  },
  {
    key: 'projetor-4k',
    name: 'Projetor 4K',
    type: 'Equipamento',
    location: 'Armário TI — 3º Andar',
    requiresApproval: true,
    costCenterCode: 'CC-TI-EQP',
    departmentSigla: 'TI',
  },
  {
    key: 'veiculo-frota',
    name: 'Veículo Frota 01',
    type: 'Veiculo',
    location: 'Estacionamento — Piso -1',
    requiresApproval: true,
    costCenterCode: 'CC-ADM-FROTA',
    departmentSigla: 'ADM',
  },
  {
    key: 'lab-quimica',
    name: 'Laboratório Química',
    type: 'Laboratorio',
    location: 'Bloco B — Piso 0',
    requiresApproval: true,
    costCenterCode: 'CC-FIN-LAB',
    departmentSigla: 'FIN',
  },
  {
    key: 'sala-comercial',
    name: 'Sala Comercial',
    type: 'Sala',
    location: '3º Andar — Comercial',
    requiresApproval: false,
    costCenterCode: 'CC-COM-SALAS',
    departmentSigla: 'COM',
  },
];

export const DEMO_RESERVATIONS: DemoReservation[] = [
  {
    key: 'res-aprovada-1',
    userEmail: 'ana.silva@reservehub.local',
    resourceKey: 'sala-rh',
    status: 'APPROVED',
    daysFromNow: 1,
    startHour: 9,
    endHour: 11,
    approverEmail: 'gestor.rh@reservehub.local',
  },
  {
    key: 'res-aprovada-2',
    userEmail: 'bruno.costa@reservehub.local',
    resourceKey: 'projetor-4k',
    status: 'APPROVED',
    daysFromNow: 2,
    startHour: 14,
    endHour: 16,
    approverEmail: 'gestor.ti@reservehub.local',
  },
  {
    key: 'res-pendente-1',
    userEmail: 'carla.mendes@reservehub.local',
    resourceKey: 'sala-executiva',
    status: 'PENDING',
    daysFromNow: 3,
    startHour: 10,
    endHour: 12,
  },
  {
    key: 'res-pendente-2',
    userEmail: 'diego.santos@reservehub.local',
    resourceKey: 'veiculo-frota',
    status: 'PENDING',
    daysFromNow: 4,
    startHour: 8,
    endHour: 18,
  },
  {
    key: 'res-rejeitada-1',
    userEmail: 'diego.santos@reservehub.local',
    resourceKey: 'lab-quimica',
    status: 'REJECTED',
    daysFromNow: -2,
    startHour: 9,
    endHour: 12,
    rejectReason: 'Laboratório indisponível para manutenção',
    approverEmail: 'admin@reservehub.local',
  },
  {
    key: 'res-cancelada-1',
    userEmail: 'ana.silva@reservehub.local',
    resourceKey: 'sala-comercial',
    status: 'CANCELLED',
    daysFromNow: 5,
    startHour: 15,
    endHour: 17,
  },
  {
    key: 'res-aprovada-3',
    userEmail: 'bruno.costa@reservehub.local',
    resourceKey: 'sala-executiva',
    status: 'APPROVED',
    daysFromNow: 0,
    startHour: 13,
    endHour: 15,
    approverEmail: 'gestor.ti@reservehub.local',
  },
];
