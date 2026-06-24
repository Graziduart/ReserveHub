# Identidade e acesso — ReserveHub

## Modelo recomendado

O **service-iam** cobre autenticação local (demo/desenvolvimento). Em produção, use um **provedor de identidade (IdP) pronto** via **OpenID Connect (OIDC)**:

| IdP | Uso típico |
|-----|------------|
| **[Keycloak](https://www.keycloak.org/)** (recomendado) | Open source, self-hosted, MFA, reset de senha, grupos/roles |
| **Google Sign-In** | OAuth 2.0 — `POST /auth/google` valida ID token e emite JWT ReserveHub |
| **Microsoft Entra ID** | Ambientes Microsoft 365 / Azure |
| **Auth0 / Okta** | SaaS gerido |

### Responsabilidades

| Função | IdP corporativo | ReserveHub (service-iam) |
|--------|------------------|---------------------------|
| Login / SSO | Sim | Valida JWT OIDC (fase produção) |
| Recuperação de senha | Sim | **Não** — removido da UI |
| MFA | Sim | Não |
| Criar utilizadores | Opcional (SCIM/sync) | **Apenas ADMIN** na app |
| Perfis RBAC (ADMIN/MANAGER/EMPLOYEE) | Grupos IdP → claims | Mantidos no core/iam |

## Recuperação de senha

Não existe fluxo “Esqueci minha senha” na aplicação. Os utilizadores devem usar o **portal do IdP** (ex.: Keycloak → *Forgot password?*).

Configure no IAM:

```env
IDP_PROVIDER=keycloak
IDP_ISSUER=https://auth.empresa.com/realms/reservehub
IDP_PASSWORD_RESET_URL=https://auth.empresa.com/realms/reservehub/login-actions/reset-credentials
```

## Criação de utilizadores

- **Frontend:** menu *Utilizadores* só visível para **Administrador** (`RequireRole ADMIN`).
- **API:** `POST /users` e `DELETE /users/:id` exigem role `ADMIN`.
- Gestores e colaboradores **não** podem criar contas.

Fluxo sugerido em produção:

1. Admin cria utilizador no ReserveHub (ou sync SCIM do IdP).
2. IdP envia e-mail de ativação / reset de senha inicial.
3. Utilizador entra via SSO ou login local com JWT unificado (`JWT_SECRET` alinhado).

## Integração OIDC (Keycloak — esboço)

1. Realm `reservehub`, client `reservehub-web` (public ou confidential).
2. Mappers: `departmentId`, `role` (ou grupos `rh-managers` → MANAGER).
3. Redirect URI: `https://app.empresa.com/login/callback`
4. Variáveis:

**service-iam**

```env
IDP_PROVIDER=keycloak
IDP_ISSUER=https://auth.empresa.com/realms/reservehub
IDP_JWKS_URI=https://auth.empresa.com/realms/reservehub/protocol/openid-connect/certs
IDP_AUTHORIZATION_URL=https://auth.empresa.com/realms/reservehub/protocol/openid-connect/auth
IDP_PASSWORD_RESET_URL=https://auth.empresa.com/realms/reservehub/login-actions/reset-credentials
```

**frontend** (opcional, para botão SSO)

```env
VITE_IDP_PROVIDER=keycloak
VITE_IDP_LOGIN_URL=https://auth.empresa.com/realms/reservehub/protocol/openid-connect/auth?client_id=reservehub-web&response_type=code&scope=openid%20profile%20email&redirect_uri=...
```

`GET /auth/idp` no IAM expõe a configuração ativa (sem segredos).

## Google Sign-In

1. Criar **ID do cliente OAuth** (Aplicativo da Web) no Google Cloud Console.
2. Origens: `http://localhost:5173`, `http://127.0.0.1:5173`.
3. Adicionar e-mails de teste na tela de consentimento OAuth (modo Teste).
4. Configurar:

**service-iam** / **docker-compose** (`.env` na raiz):

```env
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

**frontend**:

```env
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

5. O utilizador deve existir no ReserveHub com o **mesmo e-mail** do Google (criado pelo ADMIN).

Fluxo: botão Google → `POST /auth/google` com `idToken` → validação via `google-auth-library` → `issueTokensForUser()` (JWT interno inalterado nos microserviços).

## Demo local

Sem IdP: login com e-mail/senha (`admin@reservehub.local` / `ReserveHub1!`). Acesso rápido no ecrã de login apenas para demonstração.
