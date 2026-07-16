# API — Pastelaria Recanto

API NestJS + PostgreSQL para clientes, administradores, catálogo, ingredientes, pedidos e notificações.

## Execução local

1. Na raiz, execute `docker compose up -d` para iniciar o PostgreSQL isolado na porta 5433.
2. Copie `.env.example` para `.env` dentro de `api`.
3. Em `api`, execute `npm install`, `npm run seed` e `npm run start:dev`.
4. A API fica em `http://localhost:3001/api`.

O seed cria o administrador `admin@recanto.com` com senha `Recanto@123`. Troque a senha antes de publicar.

## Rotas principais

- `POST /api/auth/register` e `POST /api/auth/login`
- `GET /api/catalog/products` e `GET /api/catalog/ingredients`
- `POST /api/orders`, `GET /api/orders/mine` e `GET /api/orders/:id`
- `GET /api/notifications` e `PATCH /api/notifications/:id/read`
- CRUD administrativo em `/api/admin/catalog/*`
- Histórico e status em `/api/admin/orders` e `/api/admin/orders/:id/status`

Pagamentos estão modelados, mas a captura real deve ser conectada a um gateway antes da produção. Nunca envie dados completos de cartão para esta API.
