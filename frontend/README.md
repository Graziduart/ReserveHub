# Sistema de Gestão de Reservas de Recursos

Sistema web corporativo interno para gestão de reservas de recursos com layout reutilizável e componentes bem estruturados.

## 📋 Módulos Implementados

### 1. **Dashboard**
- Visão geral com métricas em tempo real
- Gráficos de reservas por departamento
- Gráfico de status de reservas (Pizza)
- Lista de próximas reservas
- Recursos mais utilizados

### 2. **Recursos**
- ✅ CRUD completo (Criar, Editar, Excluir)
- Filtros por tipo de recurso
- Modal de formulário
- Categorias: Sala, Equipamento, Veículo, Laboratório
- Características e especificações

### 3. **Reservas**
- ✅ CRUD completo com validações
- Criação de novas reservas
- Filtros por status
- Edição de reservas pendentes
- Cancelamento de reservas
- Modal de formulário com seleção de recursos e solicitantes

### 4. **Aprovações**
- Sistema de aprovação/rejeição de reservas
- Tabs para pendentes e processadas
- Modal de rejeição com motivo
- Visualização detalhada das reservas
- Histórico de aprovações

### 5. **Usuários**
- CRUD completo de usuários
- Filtros por departamento e status
- Busca por nome/email
- Perfis: Administrador, Gestor, Funcionário
- Gestão de status ativo/inativo

### 6. **Departamentos**
- Listagem de departamentos
- Estatísticas de colaboradores
- Gestores responsáveis
- Visão geral consolidada

### 7. **Agenda**
- Visualização em lista e calendário
- Filtro por recurso
- Reservas agrupadas por data
- Timeline de eventos
- Legenda de status

### 8. **Histórico**
- Log completo de atividades do sistema
- Filtros por tipo de atividade
- Busca em tempo real
- Estatísticas de atividades
- Timeline visual

## 🎨 Características Técnicas

### Design System
- **Cores**: Azul como cor primária, interface limpa
- **Espaçamento**: Grid de 8px consistente
- **Tipografia**: Sistema otimizado para leitura
- **Componentes**: Biblioteca completa de UI components (shadcn/ui)

### Componentes Reutilizáveis
- ✅ Buttons (Primary, Secondary, Danger, Outline, Ghost)
- ✅ Inputs (Text, Select, Date, Time)
- ✅ Cards
- ✅ Tables
- ✅ Badges / Status Tags
- ✅ Modals / Dialogs
- ✅ Toast Notifications
- ✅ Tabs
- ✅ Alerts

### Estado Global
- Context API para gerenciamento de estado
- Dados mockados para desenvolvimento
- CRUD operations completas

## 🚀 Tecnologias

- **React 18.3**
- **TypeScript**
- **React Router v7** - Navegação
- **Tailwind CSS v4** - Estilização
- **Recharts** - Gráficos
- **Lucide React** - Ícones
- **Radix UI** - Componentes acessíveis
- **Sonner** - Toast notifications

## 📦 Estrutura do Projeto

```
src/
├── app/
│   ├── components/
│   │   ├── layout/          # Sidebar, Topbar, MainLayout
│   │   ├── modals/          # RecursoModal, ReservaModal, UsuarioModal
│   │   └── ui/              # Componentes reutilizáveis (shadcn/ui)
│   ├── context/             # AppContext (Estado Global)
│   ├── data/                # mockData.ts (Dados de exemplo)
│   ├── lib/                 # Utilitários
│   ├── pages/               # Todas as páginas do sistema
│   │   ├── Dashboard.tsx
│   │   ├── Recursos.tsx
│   │   ├── Reservas.tsx
│   │   ├── Aprovacoes.tsx
│   │   ├── Usuarios.tsx
│   │   ├── Departamentos.tsx
│   │   ├── Agenda.tsx
│   │   ├── Historico.tsx
│   │   └── Login.tsx
│   ├── routes.tsx           # Configuração de rotas
│   └── App.tsx              # Componente raiz
└── styles/                  # Estilos globais e tema
```

## 💡 Funcionalidades Principais

### Sistema de Reservas
1. **Solicitar Reserva**
   - Selecionar recurso disponível
   - Escolher data e horário
   - Informar motivo
   - Status: Pendente

2. **Aprovar/Rejeitar Reserva**
   - Gestores podem aprovar ou rejeitar
   - Adicionar motivo na rejeição
   - Notificações via toast

3. **Visualizar Agenda**
   - Ver todas as reservas aprovadas
   - Filtrar por recurso
   - Visualização em lista ou calendário

### Gestão de Recursos
- Cadastrar novos recursos
- Editar informações
- Desativar recursos
- Categorizar e adicionar características

### Controle de Usuários
- Cadastrar colaboradores
- Definir perfis de acesso
- Associar a departamentos
- Ativar/desativar contas

### Auditoria
- Log de todas as ações
- Histórico completo
- Filtros e busca
- Estatísticas consolidadas

## 🔐 Perfis de Acesso

- **Administrador**: Acesso total ao sistema
- **Gestor**: Aprovações, visualização e gestão de sua área
- **Funcionário**: Criar reservas, visualizar agenda

## 📊 Dados Mockados

O sistema utiliza dados mockados para demonstração:
- 8 Usuários
- 7 Departamentos
- 8 Recursos (Salas, Equipamentos, Veículos)
- 6 Reservas
- Logs de atividades

## 🎯 Próximos Passos (Integração Backend)

Para integrar com backend real, substituir:
1. **AppContext** por chamadas de API
2. **mockData** por endpoints REST/GraphQL
3. Adicionar autenticação JWT
4. Implementar validações do servidor
5. WebSocket para notificações em tempo real
6. Upload de imagens para recursos
7. Relatórios PDF/Excel
8. Sistema de notificações por email

## 📝 Como Usar

1. **Login**: Tela inicial de login (sem autenticação real no momento)
2. **Dashboard**: Visão geral do sistema
3. **Criar Reserva**: Reservas > Nova Reserva
4. **Aprovar**: Aprovações > Aprovar/Rejeitar
5. **Gerenciar**: Recursos, Usuários, Departamentos

## 🎨 Padrão de Cores

- **Primária**: Azul (#3B82F6)
- **Sucesso**: Verde (#10B981)
- **Alerta**: Amarelo (#F59E0B)
- **Erro**: Vermelho (#EF4444)
- **Neutro**: Cinza (#6B7280)

---

**Status**: ✅ Todos os módulos implementados e funcionais com dados mockados
