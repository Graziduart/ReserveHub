# ReserveHub

Plataforma corporativa de governança de reservas de recursos organizacionais (microserviços NestJS + React).

## Arquitetura

| Serviço | Porta | Função |
|---------|-------|--------|
| **service-iam** | 3001 | Autenticação JWT, utilizadores, RBAC |
| **service-core** | 3000 | Departamentos, recursos, reservas, relatórios, eventos Rabbit |
| **service-data** | 3002 | Agregados dashboard (MongoDB + Rabbit) |
| **service-audit** | 3003 | Trilha de auditoria (MongoDB + Rabbit) |
| **frontend** | 5173 (dev) / 8080 (Docker) | UI React + Vite |

## Início rápido

```bash
# Tudo de uma vez (primeira vez ou DB vazia)
npm run start:all:seed

# Reinício rápido (DB já populada)
npm run start:all

# Parar
npm run stop:all
```

Abre **http://localhost:5173/** — login `admin@reservehub.local` / `ReserveHub1!`

Ver também [RUN.txt](RUN.txt).

## Credenciais demo (após seed)

Password padrão: `ReserveHub1!` (ou `SEED_DEMO_PASSWORD`)

| Email | Perfil |
|-------|--------|
| admin@reservehub.local | ADMIN |
| gestor.rh@reservehub.local | MANAGER |
| gestor.ti@reservehub.local | MANAGER |
| ana.silva@reservehub.local | EMPLOYEE |
| bruno.costa@reservehub.local | EMPLOYEE |
| carla.mendes@reservehub.local | EMPLOYEE |
| diego.santos@reservehub.local | EMPLOYEE |

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run start:all` | Infra + backends Docker + frontend (Vite) |
| `npm run start:all:seed` | Igual + `setup:db` (demo) |
| `npm run stop:all` | Para containers Docker |
| `npm run setup:db` | Migrações + reparos SQL + seeds core/iam |
| `npm run verify` | Health de todos os serviços |
| `npm run smoke` | Fluxo login → core → audit → relatório |
| `npm run integration` | verify + smoke |
| `npm run ci` | Build + testes e2e unitários |
| `npm run docker:up` | Compose perfil `backend` |
| `npm run docker:up:full` | Backend + frontend (perfil `full`) |

## Testes de integração (Postgres real)

```bash
set RUN_INTEGRATION_DB=1
set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/reserveHub?schema=core
npm run test:e2e --prefix service-core -- --testPathPattern=integration
```

## Troubleshooting

### P3005 — base já existia
O script `setup:db` tenta marcar migrações como aplicadas. Manualmente: ver [RUN.txt](RUN.txt).

### GET /reservations → 500 (coluna `notes` em falta)
Executar migração `20260521180000_reservation_audit_columns` — incluída no `setup:db`.

### Docker frontend falha no OneDrive
Erro `invalid file request Dockerfile`: usar `npm run dev:web` ou mover o projeto para fora do OneDrive; perfil `full` opcional.

### Migração IAM em `core._prisma_migrations`
O `setup-database.mjs` remove registos falhados de migrações IAM no schema core.

## Governança implementada

- Prioridade de departamento em conflitos de reservas pendentes
- Centro de custo em departamentos e recursos
- Aprovação com `approvedById` e RBAC
- Auditoria via Rabbit (`core.#`)
- Relatório `GET /reports/cost-allocation` (ADMIN/MANAGER)
