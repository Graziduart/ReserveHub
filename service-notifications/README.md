# service-notifications (roadmap)

Microserviço planeado para substituir polling de auditoria e `localStorage` no frontend.

## Responsabilidades

- E-mail SMTP (reservas aprovadas/rejeitadas, reset de password)
- Webhooks corporativos (Teams/Slack)
- Fila de entrega com retry

## Integração

1. Consumir eventos `core.reservation.*` via RabbitMQ
2. IAM `POST /auth/forgot-password` publicará `iam.password.reset.requested`
3. Frontend Topbar deixará de depender só de `buildNotifications()` local

## Estado atual

Stub documentado — implementação completa na Fase 7 do roadmap.
