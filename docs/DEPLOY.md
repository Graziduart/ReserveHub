# Deploy ReserveHub (produção)

## Arquitetura

- **Frontend**: build Vite → Nginx estático + reverse proxy `/api/*`
- **Backends**: `service-iam` (3001), `service-core` (3000), `service-data` (3002), `service-audit` (3003)
- **Infra**: PostgreSQL, RabbitMQ, MongoDB

## Pré-requisitos

1. Copiar `.env.production.example` para `.env` em cada serviço.
2. Definir `JWT_SECRET` **idêntico** em IAM, core, data e audit.
3. Não usar segredos demo em produção.

## Build

```bash
npm ci --prefix service-core && npm run build --prefix service-core
npm ci --prefix service-iam && npm run build --prefix service-iam
npm ci --prefix service-data && npm run build --prefix service-data
npm ci --prefix service-audit && npm run build --prefix service-audit
npm ci --prefix frontend && npm run build --prefix frontend
```

## Docker Compose (perfil `full`)

```bash
docker compose --profile full up -d --build
```

No Windows, o **core** pode correr no host (`npm run rebuild:core`) se o build Docker falhar na rede.

## Nginx

Ver `deploy/nginx.conf` — proxy para os quatro serviços e SPA fallback.

## Migrações e seed

```bash
node scripts/setup-database.mjs
```

## Reconciliação do dashboard

Após falha de RabbitMQ ou drift:

```bash
node scripts/reconcile-dashboard.mjs
```

## Health

| Serviço | URL |
|---------|-----|
| IAM | `GET /health` |
| Core | `GET /health` |
| Data | `GET /health` |
| Audit | `GET /health` |

## OpenAPI

- Core: `GET /api/docs` (Swagger, quando `ENABLE_SWAGGER=1`)
- IAM: `GET /api/docs`

## Rotação JWT

1. Gerar novo `JWT_SECRET`.
2. Atualizar env em todos os serviços.
3. Reiniciar backends (tokens antigos invalidam-se).

## Runbook incidentes

| Sintoma | Ação |
|---------|------|
| 502 no frontend | Verificar core local/Docker; `npm run rebuild:core` |
| Dashboard vazio | `node scripts/reconcile-dashboard.mjs` |
| Audit sem eventos | RabbitMQ + filas `data.events` / `audit.events` |
| 401 após desativar user | Esperado — IAM revoga refresh; core valida `active` |
