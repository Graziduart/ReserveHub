import { createBrowserRouter } from 'react-router';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Reservas } from './pages/Reservas';
import { Recursos } from './pages/Recursos';
import { Aprovacoes } from './pages/Aprovacoes';
import { Usuarios } from './pages/Usuarios';
import { Departamentos } from './pages/Departamentos';
import { Historico } from './pages/Historico';
import { Notificacoes } from './pages/Notificacoes';
import { Auditoria } from './pages/Auditoria';
import { Relatorios } from './pages/Relatorios';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'agenda', Component: Agenda },
      { path: 'reservas', Component: Reservas },
      { path: 'recursos', Component: Recursos },
      { path: 'aprovacoes', Component: Aprovacoes },
      { path: 'usuarios', Component: Usuarios },
      { path: 'departamentos', Component: Departamentos },
      { path: 'historico', Component: Historico },
      { path: 'notificacoes', Component: Notificacoes },
      { path: 'auditoria', Component: Auditoria },
      { path: 'relatorios', Component: Relatorios },
    ],
  },
]);