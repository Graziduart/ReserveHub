# Documentação OpenAPI — ReserveHub

Especificação OpenAPI 3.0 das APIs REST dos quatro microsserviços.

| Serviço | Porta | Ficheiro |
|---------|-------|----------|
| service-core | 3000 | [openapi-core.yaml](./openapi-core.yaml) |
| service-iam | 3001 | [openapi-iam.yaml](./openapi-iam.yaml) |
| service-data | 3002 | [openapi-data.yaml](./openapi-data.yaml) |
| service-audit | 3003 | [openapi-audit.yaml](./openapi-audit.yaml) |

## Visualizar

Importe qualquer ficheiro `.yaml` no [Swagger Editor](https://editor.swagger.io/) ou no Postman (Import → OpenAPI).

## Autenticação

Todos os endpoints (excepto `/health`) exigem header:

```
Authorization: Bearer <access_token>
```

Obtenha o token via `POST /auth/login` no service-iam (porta 3001).
