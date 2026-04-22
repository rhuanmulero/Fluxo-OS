# Fluxo

O **Fluxo** é um projeto estruturado em monorepo, com backend em **NestJS**, persistência em **PostgreSQL** e acesso a dados com **Prisma**.

Este README descreve como configurar e executar o projeto localmente.

## Tecnologias principais

- **Node.js** + **pnpm**
- **NestJS**
- **PostgreSQL** (Docker)
- **Prisma**

## Requisitos

- **Node.js** `>= 20.11.1` (compatível também com Node 22+)
- **pnpm** `9.x` (lockfile v9)
- **Docker** + Docker Compose

## Estrutura do repositório

```txt
.
├─ apps/
│  └─ backend/
│     ├─ prisma/
│     └─ package.json
├─ docker-compose.yml
├─ .env.example
└─ package.json
```

## Configuração

1. Crie o arquivo de ambiente a partir do exemplo:

```bash
cp .env.example .env
```

2. Configure as variáveis de banco.

Exemplo:

```env
POSTGRES_DB=fluxo
POSTGRES_USER=fluxo
POSTGRES_PASSWORD=fluxo
POSTGRES_PORT=5432
DATABASE_URL="postgresql://fluxo:fluxo@localhost:5432/fluxo"
```

## Inicialização local

1. Instale as dependências:

```bash
pnpm install
```

2. Inicie o PostgreSQL:

```bash
docker compose up -d
```

3. Gere o client do Prisma:

```bash
pnpm --filter backend prisma:generate
```

4. Execute migrações de desenvolvimento (quando necessário):

```bash
pnpm --filter backend prisma:migrate
```

5. Inicie a aplicação em desenvolvimento:

```bash
pnpm dev
```

## Scripts

### Raiz do projeto

- `pnpm dev` — inicia o backend em modo desenvolvimento
- `pnpm build` — gera build do backend
- `pnpm test` — executa testes do backend
- `pnpm lint` — executa lint do backend
- `pnpm typecheck` — valida tipos TypeScript

### Backend (`apps/backend`)

- `pnpm --filter backend start` — inicia aplicação
- `pnpm --filter backend start:dev` — inicia com watch
- `pnpm --filter backend build` — build NestJS
- `pnpm --filter backend prisma:generate` — gera Prisma Client
- `pnpm --filter backend prisma:migrate` — executa migrações Prisma
